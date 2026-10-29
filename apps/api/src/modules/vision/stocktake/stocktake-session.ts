/**
 * Stock-take agent state and tools, starting from the quick scan. Tools wrap quick-scan code and "in stock?"
 * still goes through inventory-match.ts, so the agent can improve evidence but never invent stock.
 */
import type { MatchCandidate, MatchResult } from "@tally/catalog-client";
import { matchInventory, type InventoryIndex, type Reading } from "../inventory-match";
import type { Box, ShelfProduct } from "../shelf-reader";
import { buildDetections, candidateRefs, MATCH_CANDIDATES, toCandidate, type Detection } from "../shelf-scan";

export type Evidence = { turn: number; tool: string; summary: string };

/** What the tools reach outside the session; injected so tests can script them. */
export type StocktakeDeps = {
  /** Plausible catalogue candidates for a reading (already filtered). */
  searchCatalogue(reading: Reading): Promise<MatchCandidate[]>;
  /** SAM boxes for a look, assigned to the given line's area. */
  countUnits(look: string, line: number): Promise<Box[]>;
  /** A close-up of a 0–1000 box as a data URL (JPEG/WebP), or null when too small. */
  zoom(box: Box): Promise<string | null>;
};

export const STOCKTAKE_LIMITS = { maxZooms: 20, maxSearchesPerLine: 3, maxCountsPerLine: 2 } as const;

/** Refusals before a line (or the submit) is escalated to the merchant instead of retried. */
export const MAX_REFUSALS = 3;

type Line = {
  product: ShelfProduct;
  candidates: MatchCandidate[];
  samBoxes?: Box[];
  /** count_units' latest boxes; only used when record_line asks for them. */
  pendingSam?: Box[];
  /** The Qore ID the agent recorded: kept even if the plausibility filter would drop it. */
  chosenQid: string | null;
  /** The first pass flagged it (unclear label, no match, or a store match to confirm). */
  check: boolean;
  /** The first-pass reading, to tell when the agent changes the label. */
  firstReading: string;
  zoomed: boolean;
  refusals: number;
  /** Why the merchant should look closely; set by escalation or when the agent never reviewed the line. */
  review: string | null;
  recorded: boolean;
  unresolved: string | null;
  evidence: Evidence[];
  searches: number;
  counts: number;
};

export type ToolOutput = string | ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string })[];
export type ToolResult = { output: ToolOutput; summary: string; done?: boolean };

const int = { type: "integer" };
const str = { type: "string" };
const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

/** Function tools for the Responses API (flat format). */
export const STOCKTAKE_TOOLS = [
  {
    type: "function",
    name: "zoom",
    description:
      "See a close-up of a line's product to read its label. Omit the box to use the line's clearest unit; or give a box on the 0-1000 grid of the photo.",
    parameters: obj({ line: int, x1: int, y1: int, x2: int, y2: int }, ["line"]),
  },
  {
    type: "function",
    name: "search_catalogue",
    description:
      "Search Qore Catalog for a product (Nigerian retail catalogue) with your best reading. Retry with other wording when nothing fits, e.g. a fuller name or a common local name. Max 3 searches per line.",
    parameters: obj({ line: int, brand: str, name: str, pack: str }, ["line", "name"]),
  },
  {
    type: "function",
    name: "find_in_store",
    description: "Check whether this merchant already stocks the product (their own items, not the catalogue).",
    parameters: obj({ line: int }, ["line"]),
  },
  {
    type: "function",
    name: "count_units",
    description:
      "Count the units of a line's product with a segmentation model. Give a two-word look: one colour + one container, e.g. 'red box', 'yellow bucket'. Works for rigid packs, not sachets or bags. The count is only used if record_line sets use_counted: true, so compare it with the first-pass count and the photo first.",
    parameters: obj({ line: int, look: str }, ["line", "look"]),
  },
  {
    type: "function",
    name: "record_line",
    description:
      "Record your conclusion for a line. brand, name and pack are the label exactly as printed on the pack (never copy the catalogue's product name); pack is the printed size or quantity such as '400g', '50cl', 'x12', never the container type ('' if not printed). qid is the catalogue product you matched: only one returned by search_catalogue or listed for the line. If you cannot resolve it, give unresolved_reason instead of a qid. use_counted: true to take count_units' count instead of the first-pass count.",
    parameters: obj(
      { line: int, brand: str, name: str, pack: str, qid: str, unresolved_reason: str, use_counted: { type: "boolean" } },
      ["line", "brand", "name", "pack"],
    ),
  },
  {
    type: "function",
    name: "submit_stocktake",
    description: "Finish once every line is recorded. Lines you never recorded keep the first-pass result.",
    parameters: obj({}, []),
  },
] as const;

export const STOCKTAKE_INSTRUCTIONS = [
  "You are Tally's stock-take agent for a small Nigerian shop. A first pass has already listed the products in the shelf photo; your job is to make that list right.",
  "Work through the checklist. Lines marked CHECK need attention: unclear label, no catalogue match, or a match to confirm. Lines marked OK only need record_line with what is listed.",
  "To fix a line: zoom to read the label, search_catalogue with what you read (retry with other wording if nothing fits), count_units when the count matters and the pack is rigid, then record_line.",
  "In record_line, brand, name and pack are what is printed on the pack, not the catalogue's wording: the merchant sees them, and they teach the catalogue how products look on Nigerian shelves.",
  "Never invent a Qore ID: only use one that a search returned or the checklist lists for that line. If you cannot resolve a line, record it with unresolved_reason.",
  "record_line is checked: a CHECK line or a changed label needs a zoom first, and a matched product must agree with the brand and size you read. A refused record says why; fix it and record again. After 3 refusals the line goes to the merchant.",
  "Call several tools in one turn whenever they don't depend on each other (for example, zoom into five lines at once). You have a small turn budget: record each line in the same turn you settle it, and don't keep searching a product the catalogue clearly lacks.",
  "When every line is recorded, call submit_stocktake.",
].join("\n");

export class StocktakeSession {
  readonly lines: Line[];
  private zooms = 0;
  private submitRefusals = 0;
  submitted = false;

  constructor(
    products: ShelfProduct[],
    matches: MatchResult[],
    samBoxes: Map<number, Box[]>,
    private readonly inventory: InventoryIndex,
    private readonly deps: StocktakeDeps,
  ) {
    const byRef = new Map(matches.map((m) => [m.ref, m.candidates]));
    const first = buildDetections(products, matches, inventory, samBoxes);
    this.lines = products.map((product, i) => ({
      product: { ...product },
      candidates: byRef.get(String(i)) ?? [],
      samBoxes: samBoxes.get(i),
      chosenQid: null,
      check: first[i]!.confidence !== "high" || !first[i]!.candidates[0] || first[i]!.inventoryNeedsConfirm,
      firstReading: readingOf(product),
      zoomed: false,
      refusals: 0,
      review: null,
      recorded: false,
      unresolved: null,
      evidence: [],
      searches: 0,
      counts: 0,
    }));
  }

  /** The first-pass detections, as the agent sees them: the starting checklist. */
  checklist(): string {
    const detections = this.detections();
    const rows = detections.map((d, i) => {
      const read = [d.brand, d.name, d.pack].filter(Boolean).join(" · ") || "(unreadable)";
      const top = d.candidates[0];
      const match = top ? `${top.qid} ${top.name} (score ${top.score.toFixed(2)})` : "no catalogue match";
      const store = d.inventoryItemId ? `in store${d.inventoryNeedsConfirm ? " (to confirm)" : ""}` : "not in store";
      const check = this.lines[i]!.check ? "CHECK" : "OK";
      const box = d.boxes[0];
      return `${i}. [${check}] ${read} | count ${d.count} (${d.countSource}) | ${match} | ${store} | box ${box ? `${box.x1},${box.y1},${box.x2},${box.y2}` : "-"}`;
    });
    return `Checklist (${rows.length} lines):\n${rows.join("\n")}`;
  }

  async execute(name: string, rawArgs: string, turn: number): Promise<ToolResult> {
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
    } catch {
      return { output: "Error: arguments were not valid JSON.", summary: "invalid JSON arguments" };
    }
    if (name === "submit_stocktake") return this.submit();

    const index = typeof args.line === "number" ? args.line : -1;
    const line = this.lines[index];
    if (!line) return { output: `Error: no line ${String(args.line)}. Lines are 0-${this.lines.length - 1}.`, summary: "unknown line" };

    const result = await this.run(name, args, line, index);
    line.evidence.push({ turn, tool: name, summary: result.summary });
    return result;
  }

  private async run(name: string, args: Record<string, unknown>, line: Line, index: number): Promise<ToolResult> {
    const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 120) : "");
    switch (name) {
      case "zoom": {
        if (this.zooms >= STOCKTAKE_LIMITS.maxZooms) return { output: "Error: zoom budget used up; work with what you have.", summary: "zoom refused: budget" };
        const box = toBox(args) ?? largest(line.samBoxes?.length ? line.samBoxes : line.product.boxes);
        if (!box) return { output: "Error: no box for this line; give one.", summary: "zoom: no box" };
        const image = await this.deps.zoom(box);
        this.zooms++;
        if (image) line.zoomed = true;
        const what = [line.product.brand, line.product.name].filter(Boolean).join(" ") || `line ${index}`;
        if (!image) return { output: "That area is too small to read; try a larger box.", summary: `"${what}": label too small to read` };
        return {
          output: [
            { type: "input_text", text: `Close-up of line ${index}:` },
            { type: "input_image", image_url: image },
          ],
          summary: `read the label of "${what}" up close`,
        };
      }
      case "search_catalogue": {
        if (line.searches >= STOCKTAKE_LIMITS.maxSearchesPerLine) return { output: "Error: 3 searches used for this line.", summary: "search refused: budget" };
        line.searches++;
        const reading = { brand: text(args.brand), name: text(args.name), pack: text(args.pack) };
        if (!reading.name) return { output: "Error: name is required.", summary: "search: no name" };
        const found = await this.deps.searchCatalogue(reading);
        // Keep every candidate the line has seen, newest first, so record_line can pick any of them.
        line.candidates = dedupe([...found, ...line.candidates]);
        const list = found.slice(0, 5).map((c) => `${c.qid} ${c.name} (score ${c.score.toFixed(2)}, size ${sizeWord(c.signals.size)})`);
        return {
          output: list.length ? `Plausible matches:\n${list.join("\n")}` : "No plausible match in the catalogue for that wording.",
          summary: `search "${[reading.brand, reading.name, reading.pack].filter(Boolean).join(" ")}" → ${found.length} plausible`,
        };
      }
      case "find_in_store": {
        const m = matchInventory(line.product, candidateRefs(line.candidates), this.inventory);
        const item = m ? this.inventory.unlinked.find((i) => i.id === m.itemId) : undefined;
        const out = !m
          ? "Not in the merchant's store."
          : `In store: item ${m.itemId}${item ? ` (${item.name})` : ""}, found by ${m.match}${m.archived ? ", but the merchant removed it" : ""}${m.sure ? "" : "; the merchant must confirm"}.`;
        return { output: out, summary: m ? `in store via ${m.match}${m.sure ? "" : " (confirm)"}` : "not in store" };
      }
      case "count_units": {
        if (line.counts >= STOCKTAKE_LIMITS.maxCountsPerLine) return { output: "Error: 2 counts used for this line.", summary: "count refused: budget" };
        line.counts++;
        const look = text(args.look).toLowerCase();
        if (!look) return { output: "Error: look is required.", summary: "count: no look" };
        const boxes = await this.deps.countUnits(look, index);
        line.pendingSam = boxes.length > 0 ? boxes : undefined;
        const current = line.samBoxes?.length ?? line.product.count;
        return {
          output: boxes.length
            ? `Counted ${boxes.length} units of "${look}" for line ${index} (current count ${current}). Use it with record_line use_counted: true if it looks right.`
            : `Found no "${look}" units near line ${index}; the current count (${current}) stands.`,
          summary: `count "${look}" → ${boxes.length}`,
        };
      }
      case "record_line": {
        if (line.recorded) return { output: `Line ${index} is already recorded.`, summary: "record refused: already recorded" };
        const reading = { brand: text(args.brand), name: text(args.name), pack: text(args.pack) };
        const qid = text(args.qid);
        const problem = this.verifyRecord(line, reading, qid, args.use_counted === true);
        if (problem) return this.refuse(line, index, problem);
        line.product = { ...line.product, brand: reading.brand, name: reading.name || reading.brand, pack: reading.pack };
        if (args.use_counted === true) line.samBoxes = line.pendingSam;
        // The chosen product goes first, so it becomes the line's top candidate.
        if (qid) line.candidates = [line.candidates.find((c) => c.qid === qid)!, ...line.candidates.filter((c) => c.qid !== qid)];
        line.chosenQid = qid || null;
        line.unresolved = qid ? null : text(args.unresolved_reason) || null;
        line.recorded = true;
        return {
          output: "Recorded.",
          summary: qid ? `recorded as ${qid}` : line.unresolved ? `recorded unresolved: ${line.unresolved}` : `recorded "${line.product.name}" without a catalogue match`,
        };
      }
      default:
        return { output: `Error: unknown tool ${name}.`, summary: `unknown tool ${name}` };
    }
  }

  /**
   * Verification at record_line (the workshop pattern: fixed checks the model
   * can't skip, refused with feedback it can act on). Null when it passes.
   */
  private verifyRecord(line: Line, reading: Reading, qid: string, useCounted: boolean): string | null {
    if (!reading.name && !reading.brand) return "give at least a name or brand.";
    const chosen = qid ? line.candidates.find((c) => c.qid === qid) : undefined;
    if (qid && !chosen) return `${qid} was not returned for this line. Use a Qore ID from a search, or give unresolved_reason.`;
    if (useCounted && !line.pendingSam) return "use_counted needs a count_units result for this line.";
    // Grounding: a line the first pass flagged, or a changed label, must have been looked at.
    const changed = readingOf({ ...line.product, ...reading }) !== line.firstReading;
    if ((line.check || changed) && !line.zoomed && this.zooms < STOCKTAKE_LIMITS.maxZooms) {
      return line.check ? "this line was flagged: zoom into it before recording." : "you changed the label: zoom into it first so the reading comes from the pack.";
    }
    if (chosen && reading.brand && chosen.brand && !sameBrand(reading.brand, chosen.brand.name)) {
      return `${qid} is a ${chosen.brand.name} product but you read "${reading.brand}". Pick a ${reading.brand} product or leave qid empty.`;
    }
    const read = parseSize(reading.pack);
    if (chosen && read && chosen.size && !sameSize(read, chosen.size)) {
      return `${qid} is ${chosen.size.value}${chosen.size.unit} but the pack says ${reading.pack}. Pick the matching size or leave qid empty.`;
    }
    return null;
  }

  /** Refuse with feedback; after MAX_REFUSALS the line goes to the merchant unresolved instead. */
  private refuse(line: Line, index: number, problem: string): ToolResult {
    line.refusals++;
    if (line.refusals < MAX_REFUSALS) return { output: `Refused: ${problem}`, summary: `record refused: ${problem}` };
    line.recorded = true;
    line.chosenQid = null;
    line.review = `Escalated after ${MAX_REFUSALS} refused records: ${problem}`;
    return { output: `Line ${index} is escalated to the merchant: ${problem}`, summary: `escalated: ${problem}` };
  }

  /** Refused while lines are open; on the third try it ends anyway with those lines flagged for the merchant. */
  private submit(): ToolResult {
    const open = this.lines.map((l, i) => (l.recorded ? -1 : i)).filter((i) => i >= 0);
    if (open.length && ++this.submitRefusals < MAX_REFUSALS) {
      return { output: `Refused: lines ${open.join(", ")} are not recorded. Record them, or record them with unresolved_reason.`, summary: `submit refused: ${open.length} open` };
    }
    this.submitted = true;
    return {
      output: open.length ? `Submitted. Lines ${open.join(", ")} go to the merchant unreviewed.` : "Submitted.",
      summary: open.length ? `submitted with ${open.length} unreviewed line(s)` : "submitted",
      done: true,
    };
  }

  /** The stock-take result in the shelf-scan shape, with each line's evidence. */
  /** review: null, or why the merchant should look closely (escalated, or never reviewed by the agent). */
  detections(): (Detection & { evidence: Evidence[]; review: string | null })[] {
    const products = this.lines.map((l) => l.product);
    const matches: MatchResult[] = this.lines.map((l, i) => ({ ref: String(i), query: { brand: null, name: "", pack: null }, parsedPack: null, candidates: l.candidates }));
    const sam = new Map(this.lines.flatMap((l, i) => (l.samBoxes ? [[i, l.samBoxes] as [number, Box[]]] : [])));
    return buildDetections(products, matches, this.inventory, sam).map((d, i) => {
      const line = this.lines[i]!;
      // The plausibility filter judges candidates against the (possibly rewritten) brand; a product the
      // agent explicitly recorded stays on top, and the merchant still confirms it.
      const review =
        line.review ??
        (!line.recorded ? "Not reviewed by the agent: first-pass result." : line.unresolved ? `Agent couldn't confirm: ${line.unresolved}` : null);
      if (line.chosenQid && d.candidates[0]?.qid !== line.chosenQid) {
        const chosen = line.candidates.find((c) => c.qid === line.chosenQid)!;
        const rest = d.candidates.filter((c) => c.qid !== line.chosenQid);
        return { ...d, candidates: [toCandidate(chosen, this.inventory), ...rest].slice(0, MATCH_CANDIDATES), evidence: line.evidence, review };
      }
      return { ...d, evidence: line.evidence, review };
    });
  }
}

function toBox(a: Record<string, unknown>): Box | null {
  const n = [a.x1, a.y1, a.x2, a.y2];
  if (!n.every((v) => typeof v === "number")) return null;
  const [x1, y1, x2, y2] = (n as number[]).map((v) => Math.min(1000, Math.max(0, Math.round(v)))) as [number, number, number, number];
  return x2 > x1 && y2 > y1 ? { x1, y1, x2, y2 } : null;
}

function largest(boxes: Box[]): Box | null {
  return boxes.reduce<Box | null>((best, b) => (!best || (b.x2 - b.x1) * (b.y2 - b.y1) > (best.x2 - best.x1) * (best.y2 - best.y1) ? b : best), null);
}

function dedupe(candidates: MatchCandidate[]): MatchCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => !seen.has(c.qid) && seen.add(c.qid));
}

const sizeWord = (s: number) => (s === 1 ? "matches" : s === 0.5 ? "unknown" : "differs");

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function readingOf(p: Pick<ShelfProduct, "brand" | "name" | "pack">): string {
  return [p.brand, p.name, p.pack].map(norm).join("|");
}

/** Ignores case, spaces and punctuation; a brand containing the other (e.g. plus a product word) is the same brand. */
function sameBrand(read: string, catalogue: string): boolean {
  const a = norm(read);
  const b = norm(catalogue);
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

const UNITS: Record<string, { base: "g" | "ml"; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  mg: { base: "g", factor: 0.001 },
  ml: { base: "ml", factor: 1 },
  cl: { base: "ml", factor: 10 },
  l: { base: "ml", factor: 1000 },
  ltr: { base: "ml", factor: 1000 },
};

/** "400g", "50 cl", "1.5L" → amount in g or ml; null for anything else (packs of n, words). */
function parseSize(pack: string): { base: "g" | "ml"; amount: number } | null {
  const m = /(\d+(?:\.\d+)?)\s*(kg|mg|g|ml|cl|ltr|l)\b/i.exec(pack);
  const u = m ? UNITS[m[2]!.toLowerCase()] : undefined;
  return m && u ? { base: u.base, amount: Number(m[1]) * u.factor } : null;
}

function sameSize(read: { base: "g" | "ml"; amount: number }, size: { value: number; unit: string }): boolean {
  const u = UNITS[size.unit.toLowerCase()];
  if (!u || u.base !== read.base) return true; // can't compare: don't block
  const amount = size.value * u.factor;
  return Math.abs(amount - read.amount) <= 0.05 * Math.max(amount, read.amount);
}
