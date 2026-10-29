/**
 * Experimental shelf sweep: read a shelf like a person counting it, row by row and left to right, one cell per
 * Muse Spark call, then stitch the cells back onto the photo's 0–1000 grid. Benchmark-only until it earns a switch.
 */
import sharp from "sharp";
import type { MetaModelClient, ResponsesUsage } from "./meta-model.client";
import { MAX_PRODUCTS, parseShelfProducts, SHELF_MODEL, shelfRequest, type Box, type Confidence, type ShelfProduct } from "./shelf-reader";

/** Each cell's crop reaches this share of its size past its edges, so a unit cut by one edge is whole in a neighbour. */
export const OVERLAP = 0.1;
export const MAX_ROWS = 6;
export const MAX_BAYS = 3;
export const MAX_CELLS = 12;
/** Bands thinner than this (0–1000 grid) are noise, not a shelf row or bay. */
const MIN_BAND = 30;
/** When the layout read fails: three rows by two bays. */
export const FALLBACK_GRID = { rows: 3, bays: 2 } as const;
export const SWEEP_LIMITS = { concurrency: 4, cellTimeoutMs: 45_000, layoutTimeoutMs: 30_000, deadlineMs: 80_000 } as const;
/** Small photos are enlarged so a cell is never tinier than this to the model; big cells are capped. */
const MIN_CELL_LONG_SIDE = 1024;
const MAX_CELL_LONG_SIDE = 2048;
const LAYOUT_LONG_SIDE = 1024;
/** Same product's boxes overlapping this much are one unit; any two boxes this alike are one unit. */
const SAME_UNIT_IOU = 0.5;
const SAME_BOX_IOU = 0.8;

export type Cell = {
  /** Reading order: row by row, left to right. */
  index: number;
  row: number;
  bay: number;
  label: string;
  /** The cell's own area; units whose centre lies here belong to it. 0–1000 grid. */
  core: Box;
  /** The area sent to the model: the core plus overlap. 0–1000 grid. */
  crop: Box;
};

export type CellStatus = "read" | "empty" | "unreadable";

export type CellRead = {
  cell: Cell;
  status: CellStatus;
  /** Boxes on the cell's own 0–1000 grid. */
  products: ShelfProduct[];
  ms: number;
  usage: { input: number; output: number };
  error: string | null;
};

export type SweepResult = {
  /** On the photo's 0–1000 grid, ready for SAM counting and catalogue matching. */
  products: ShelfProduct[];
  /** Per product, the cells (by index) that saw it. */
  sources: number[][];
  cells: (Omit<CellRead, "products"> & { products: number; units: number; summary: string })[];
  layout: { source: "model" | "grid"; rows: number; bays: number; error: string | null };
  /** Spark tokens across the layout call and every cell call. */
  usage: { input: number; output: number; calls: number };
  ms: number;
};

// ── Layout ──

const BAND = (lo: string, hi: string) => ({
  type: "object",
  properties: { [lo]: { type: "integer" }, [hi]: { type: "integer" } },
  required: [lo, hi],
  additionalProperties: false,
});

export const LAYOUT_SCHEMA = {
  type: "object",
  properties: {
    rows: { type: "array", items: BAND("y_min", "y_max"), description: "Shelf rows, top to bottom." },
    bays: { type: "array", items: BAND("x_min", "x_max"), description: "Vertical sections, left to right; one when the shelf is narrow." },
  },
  required: ["rows", "bays"],
  additionalProperties: false,
};

const LAYOUT_PROMPT = [
  "You are looking at a photo of stock in a Nigerian shop: a shelf, a counter or a pile of goods.",
  "Split the area holding products into shelf rows: horizontal bands from top to bottom, one per shelf level (or one per layer of a pile).",
  "If a row holds more than about 12 products side by side, also split the shelving into bays: vertical sections from left to right. Otherwise give one bay spanning all products.",
  "Give rows as y_min, y_max and bays as x_min, x_max on a normalized 0-1000 grid with (0,0) at the top-left of the image. Together they must cover every product.",
].join("\n");

/** POST /v1/responses body for the sweep's layout read (a small copy of the photo is enough). */
export function layoutRequest(image: Buffer): Record<string, unknown> {
  return {
    model: SHELF_MODEL,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: LAYOUT_PROMPT },
          { type: "input_image", image_url: `data:image/jpeg;base64,${image.toString("base64")}` },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "shelf_layout", schema: LAYOUT_SCHEMA, strict: true } },
    reasoning: { effort: "low" },
    max_output_tokens: 2000,
  };
}

/** Spark's layout → row and bay cut points (each from 0 to 1000), or null when unusable. */
export function parseLayout(text: string): { rows: number[]; bays: number[] } | null {
  let raw: { rows?: unknown; bays?: unknown };
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const bands = (v: unknown, lo: string, hi: string) =>
    (Array.isArray(v) ? v : []).map((b: Record<string, unknown>) => [b?.[lo], b?.[hi]]).filter((b): b is [number, number] => b.every(Number.isFinite));
  const rows = bandsToCuts(bands(raw?.rows, "y_min", "y_max"), MAX_ROWS);
  if (!rows) return null;
  const bays = bandsToCuts(bands(raw?.bays, "x_min", "x_max"), MAX_BAYS) ?? [0, 1000];
  const rowCount = rows.length - 1;
  const bayCount = Math.min(bays.length - 1, Math.max(1, Math.floor(MAX_CELLS / rowCount)));
  return { rows, bays: bayCount === bays.length - 1 ? bays : gridCuts(bayCount) };
}

/**
 * Bands → contiguous cut points from 0 to 1000: thin bands dropped, heavily overlapping ones merged, and each
 * boundary halfway between neighbours so nothing between bands goes unread. Null when no band is left.
 */
export function bandsToCuts(bands: [number, number][], max: number): number[] | null {
  const clean = bands
    .map(([a, b]) => [clamp(Math.min(a, b)), clamp(Math.max(a, b))] as [number, number])
    .filter(([a, b]) => b - a >= MIN_BAND)
    .sort((p, q) => p[0] - q[0]);
  const merged: [number, number][] = [];
  for (const band of clean) {
    const last = merged[merged.length - 1];
    const shared = last ? Math.min(last[1], band[1]) - band[0] : 0;
    if (last && shared > 0.5 * Math.min(last[1] - last[0], band[1] - band[0])) last[1] = Math.max(last[1], band[1]);
    else merged.push([...band]);
  }
  if (merged.length === 0) return null;
  if (merged.length > max) return gridCuts(max);
  return [0, ...merged.slice(1).map((band, i) => Math.round((merged[i]![1] + band[0]) / 2)), 1000];
}

/** n equal bands' cut points. */
export const gridCuts = (n: number) => Array.from({ length: n + 1 }, (_, i) => Math.round((i * 1000) / n));

/** Cells in reading order, each crop widened by `overlap` of its size on every side (clamped to the photo). */
export function layoutCells(rowCuts: number[], bayCuts: number[], overlap = OVERLAP): Cell[] {
  const rows = rowCuts.length - 1;
  const bays = bayCuts.length - 1;
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let bay = 0; bay < bays; bay++) {
      const core = { x1: bayCuts[bay]!, y1: rowCuts[row]!, x2: bayCuts[bay + 1]!, y2: rowCuts[row + 1]! };
      const padX = (core.x2 - core.x1) * overlap;
      const padY = (core.y2 - core.y1) * overlap;
      const crop = { x1: clamp(core.x1 - padX), y1: clamp(core.y1 - padY), x2: clamp(core.x2 + padX), y2: clamp(core.y2 + padY) };
      cells.push({ index: cells.length, row, bay, label: cellLabel(row, bay, bays), core, crop });
    }
  }
  return cells;
}

const BAY_NAMES: Record<number, string[]> = { 2: ["left", "right"], 3: ["left", "middle", "right"] };

/** "Row 2, left" for the merchant; just "Row 2" when the shelf is one bay wide. */
export function cellLabel(row: number, bay: number, bays: number): string {
  if (bays <= 1) return `Row ${row + 1}`;
  return `Row ${row + 1}, ${BAY_NAMES[bays]?.[bay] ?? `bay ${bay + 1}`}`;
}

// ── Mapping and stitching ──

/** Pixel rectangle of a 0–1000 crop, and the crop snapped to those whole pixels so mapping back is exact. */
export function cellPixels(crop: Box, width: number, height: number) {
  // The epsilon keeps float noise (0.55 × 3000 = 1650.0000000000002) from adding a pixel.
  const left = Math.max(0, Math.floor((crop.x1 / 1000) * width + 1e-6));
  const top = Math.max(0, Math.floor((crop.y1 / 1000) * height + 1e-6));
  const right = Math.min(width, Math.ceil((crop.x2 / 1000) * width - 1e-6));
  const bottom = Math.min(height, Math.ceil((crop.y2 / 1000) * height - 1e-6));
  return {
    region: { left, top, width: right - left, height: bottom - top },
    crop: { x1: (left / width) * 1000, y1: (top / height) * 1000, x2: (right / width) * 1000, y2: (bottom / height) * 1000 },
  };
}

/** A box on a cell's 0–1000 grid → the photo's 0–1000 grid. */
export function toPhoto(box: Box, crop: Box): Box {
  const sx = (crop.x2 - crop.x1) / 1000;
  const sy = (crop.y2 - crop.y1) / 1000;
  const at = (n: number) => Math.round(clamp(n));
  return { x1: at(crop.x1 + box.x1 * sx), y1: at(crop.y1 + box.y1 * sy), x2: at(crop.x1 + box.x2 * sx), y2: at(crop.y1 + box.y2 * sy) };
}

/**
 * Cell reads → one product list on the photo's grid. A unit belongs to the cell whose core holds its centre, so
 * overlaps don't double count; an unread owner's units are taken from neighbours. Same brand + name merge.
 */
export function stitch(reads: CellRead[]): { products: ShelfProduct[]; sources: number[][] } {
  const cells = reads.map((r) => r.cell);
  const statusOf = new Map(reads.map((r) => [r.cell.index, r.status]));
  const merged: (ShelfProduct & { sources: number[] })[] = [];

  for (const r of reads) {
    for (const p of r.products) {
      const boxes = p.boxes
        .map((b) => toPhoto(b, r.cell.crop))
        .filter((b) => {
          const owner = cells.find((c) => inCore(c.core, centre(b)));
          return !owner || owner.index === r.cell.index || statusOf.get(owner.index) !== "read";
        });
      if (boxes.length === 0) continue;
      const same = merged.find((m) => sameProduct(m, p));
      if (!same) {
        merged.push({ ...p, boxes: dedupe(boxes), count: 0, sources: [r.cell.index] });
        continue;
      }
      same.boxes = dedupe([...same.boxes, ...boxes]);
      if (!same.pack) same.pack = p.pack;
      if (!same.brand) same.brand = p.brand;
      if (rank(p.confidence) > rank(same.confidence)) same.confidence = p.confidence;
      if (!same.sources.includes(r.cell.index)) same.sources.push(r.cell.index);
    }
  }

  // Nearly the same box read as two different products: the more confident reading keeps it.
  for (const [i, a] of merged.entries()) {
    for (const b of merged.slice(i + 1)) {
      const [keep, lose] = rank(b.confidence) > rank(a.confidence) ? [b, a] : [a, b];
      lose.boxes = lose.boxes.filter((x) => !keep.boxes.some((y) => iou(x, y) > SAME_BOX_IOU));
    }
  }

  const kept = merged.filter((m) => m.boxes.length > 0).slice(0, MAX_PRODUCTS);
  return {
    products: kept.map(({ sources: _, ...p }) => ({ ...p, count: p.boxes.length })),
    sources: kept.map((m) => m.sources),
  };
}

/** The merchant-facing line per cell, e.g. "Row 2, left: 4 products (11 units)". */
export function cellSummary(label: string, status: CellStatus, products: number, units: number): string {
  if (status === "unreadable") return `${label}: could not be read`;
  if (status === "empty") return `${label}: no products`;
  return `${label}: ${products} product${products === 1 ? "" : "s"} (${units} unit${units === 1 ? "" : "s"})`;
}

/** Baseline trace steps for a stock-take run: the layout, then one per cell in reading order. */
export function sweepSteps(s: Pick<SweepResult, "cells" | "layout">): { turn: 0; kind: "baseline"; summary: string; ms?: number }[] {
  const how = s.layout.source === "model" ? "" : " (fixed grid)";
  return [
    { turn: 0, kind: "baseline", summary: `Sweep: ${s.layout.rows} row${s.layout.rows === 1 ? "" : "s"} × ${s.layout.bays} bay${s.layout.bays === 1 ? "" : "s"}${how}` },
    ...s.cells.map((c) => ({ turn: 0 as const, kind: "baseline" as const, summary: c.summary, ms: c.ms })),
  ];
}

// ── Running it ──

/**
 * Layout read (fixed grid on failure), then every cell read with the quick scan's prompt, a few at a time,
 * all inside one deadline. Throws only when no cell could be read.
 */
export async function sweepShelf(
  client: Pick<MetaModelClient, "respond">,
  image: Buffer,
  opts: { layout?: "model" | "grid"; concurrency?: number; cellTimeoutMs?: number; deadlineMs?: number } = {},
): Promise<SweepResult> {
  const started = Date.now();
  const limits = { ...SWEEP_LIMITS, ...opts };
  const usage = { input: 0, output: 0, calls: 0 };
  const add = (u: ResponsesUsage | null) => {
    usage.input += u?.input_tokens ?? 0;
    usage.output += u?.output_tokens ?? 0;
    usage.calls++;
  };

  const { data, info } = await sharp(image).rotate().raw().toBuffer({ resolveWithObject: true });
  const raw = { raw: { width: info.width, height: info.height, channels: info.channels } } as const;

  let cuts = { rows: gridCuts(FALLBACK_GRID.rows), bays: gridCuts(FALLBACK_GRID.bays) };
  let layout: SweepResult["layout"] = { source: "grid", rows: FALLBACK_GRID.rows, bays: FALLBACK_GRID.bays, error: null };
  if (opts.layout !== "grid") {
    try {
      const small = await sharp(data, raw).resize({ width: LAYOUT_LONG_SIDE, height: LAYOUT_LONG_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      const res = await client.respond(layoutRequest(small), limits.layoutTimeoutMs);
      add(res.usage);
      const parsed = parseLayout(res.text);
      if (!parsed) throw new Error("Layout had no usable rows");
      cuts = parsed;
      layout = { source: "model", rows: parsed.rows.length - 1, bays: parsed.bays.length - 1, error: null };
    } catch (err) {
      layout.error = (err as Error).message.slice(0, 200);
    }
  }

  const cells = layoutCells(cuts.rows, cuts.bays);
  const reads: CellRead[] = new Array(cells.length);
  let next = 0;
  const worker = async () => {
    while (next < cells.length) {
      const cell = cells[next++]!;
      const { region, crop } = cellPixels(cell.crop, info.width, info.height);
      const snapped = { ...cell, crop };
      const t0 = Date.now();
      const left = limits.deadlineMs - (t0 - started);
      if (left < 5_000) {
        reads[cell.index] = { cell: snapped, status: "unreadable", products: [], ms: 0, usage: { input: 0, output: 0 }, error: "Sweep deadline reached" };
        continue;
      }
      try {
        const long = Math.max(region.width, region.height);
        const side = Math.min(MAX_CELL_LONG_SIDE, Math.max(MIN_CELL_LONG_SIDE, long));
        const jpeg = await sharp(data, raw).extract(region).resize({ width: side, height: side, fit: "inside" }).jpeg({ quality: 90 }).toBuffer();
        const res = await client.respond(shelfRequest(jpeg, "image/jpeg"), Math.min(limits.cellTimeoutMs, left));
        add(res.usage);
        const products = parseShelfProducts(res.text);
        const u = { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 };
        reads[cell.index] = { cell: snapped, status: products.length ? "read" : "empty", products, ms: Date.now() - t0, usage: u, error: null };
      } catch (err) {
        reads[cell.index] = { cell: snapped, status: "unreadable", products: [], ms: Date.now() - t0, usage: { input: 0, output: 0 }, error: (err as Error).message.slice(0, 200) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limits.concurrency, cells.length) }, worker));

  if (reads.every((r) => r.status === "unreadable")) throw new Error(`No sweep cell could be read: ${reads[0]?.error ?? "unknown"}`);
  const { products, sources } = stitch(reads);
  return {
    products,
    sources,
    cells: reads.map(({ products: ps, ...r }) => {
      const units = ps.reduce((n, p) => n + p.count, 0);
      return { ...r, products: ps.length, units, summary: cellSummary(r.cell.label, r.status, ps.length, units) };
    }),
    layout,
    usage,
    ms: Date.now() - started,
  };
}

// ── Helpers ──

type Point = { x: number; y: number };
const clamp = (n: number) => Math.min(1000, Math.max(0, n));
const centre = (b: Box): Point => ({ x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 });
/** Half-open so a point on a shared edge has exactly one owner; the photo's far edges stay inside. */
const inCore = (c: Box, p: Point) => p.x >= c.x1 && (p.x < c.x2 || c.x2 === 1000) && p.y >= c.y1 && (p.y < c.y2 || c.y2 === 1000);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").trim();

/** Same brand and name (an unread brand matches any), and packs that agree or one is unread. */
function sameProduct(a: ShelfProduct, b: ShelfProduct): boolean {
  if (norm(a.name) !== norm(b.name)) return false;
  if (a.brand && b.brand && norm(a.brand) !== norm(b.brand)) return false;
  return !a.pack || !b.pack || norm(a.pack) === norm(b.pack);
}

/** Drops a box that overlaps an earlier one of the same product as one unit. */
function dedupe(boxes: Box[]): Box[] {
  const out: Box[] = [];
  for (const b of boxes) if (!out.some((o) => iou(o, b) > SAME_UNIT_IOU)) out.push(b);
  return out;
}

function iou(a: Box, b: Box): number {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter);
}

function rank(c: Confidence): number {
  return c === "high" ? 2 : c === "medium" ? 1 : 0;
}
