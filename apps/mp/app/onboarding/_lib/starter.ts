import type { SubtypeTemplates } from "@tally/catalog-client";

// Starter-items model shared by the setup wizard and the /onboarding/[businessId]/items retry page.
// Pure functions only: imported by server components, server actions and client components.

export type Candidate = {
  qid: string;
  name: string;
  variantLabel: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  packQty: number;
  categoryPath: string;
  score: number;
  priceMedian: number | null;
};

export type TemplateRow = {
  key: string;
  groupLabel: string;
  templateName: string;
  candidates: Candidate[];
};

export type RowState = { keep: boolean; choice: string; ownName: string; price: string; opening: string };
export type RowProblems = { name: boolean; price: boolean; opening: boolean };

export type StarterItemInput = {
  clientRef: string;
  templateItemName: string;
  outcome: "accepted" | "corrected" | "new_item" | "removed";
  suggestedQid?: string;
  suggestedScore?: number;
  qid?: string;
  name?: string;
  variantLabel?: string;
  sizeValue?: number;
  sizeUnit?: string;
  packQty?: number;
  categoryPath?: string;
  price?: string;
  openingQuantity?: number;
};

export type StarterResult = {
  created: number;
  skipped: number;
  removed: number;
  invalid: { clientRef: string; reason: string }[];
  feedback: { sent: number; recorded?: number; duplicates?: number; error?: string };
};

export const OWN = "own";
export const NO_PROBLEMS: RowProblems = { name: false, price: false, opening: false };
const NAIRA = /^\d{1,10}(\.\d{1,2})?$/;

/** Flatten template groups into one row per item, with the catalogue's candidates deduped. */
export function toRows(templates: SubtypeTemplates): TemplateRow[] {
  return templates.templates.flatMap((t) =>
    t.groups.flatMap((g) =>
      g.items.map((item, i) => {
        const seen = new Set<string>();
        // Ranked suggestions (with prices) first, then the template's own product if it isn't among them.
        const pool = [
          ...(item.suggestions ?? []),
          ...(item.product ? [{ ...item.product, score: 0, price: null }] : []),
        ];
        const candidates = pool.filter((c) => !seen.has(c.qid) && seen.add(c.qid));
        return {
          key: `${t.code}:${g.code}:${i}`,
          groupLabel: g.label,
          templateName: item.name,
          candidates: candidates.map((c) => ({
            qid: c.qid,
            name: c.name,
            variantLabel: c.variantLabel,
            sizeValue: c.size?.value ?? null,
            sizeUnit: c.size?.unit ?? null,
            packQty: c.packQty,
            categoryPath: c.category.path,
            score: c.score,
            priceMedian: c.price?.median ?? null,
          })),
        };
      }),
    ),
  );
}

export function initialState(row: TemplateRow): RowState {
  const first = row.candidates[0];
  return {
    // Suggested items start kept; items with nothing to suggest start off (they need a name and price).
    keep: Boolean(first),
    choice: first ? first.qid : OWN,
    ownName: "",
    price: first?.priceMedian != null ? String(first.priceMedian) : "",
    opening: "",
  };
}

export function initialStates(rows: TemplateRow[]): Record<string, RowState> {
  return Object.fromEntries(rows.map((r) => [r.key, initialState(r)]));
}

export function rowProblems(row: TemplateRow, s: RowState): RowProblems {
  if (!s.keep) return NO_PROBLEMS;
  const opening = s.opening.trim();
  return {
    name: s.choice === OWN && s.ownName.trim().length === 0,
    price: !NAIRA.test(s.price.trim()),
    opening: opening !== "" && !(Number(opening) >= 0 && /^\d+(\.\d{1,3})?$/.test(opening)),
  };
}

export function invalidRowKeys(rows: TemplateRow[], state: Record<string, RowState>): string[] {
  return rows.filter((r) => Object.values(rowProblems(r, state[r.key]!)).some(Boolean)).map((r) => r.key);
}

export function toStarterItem(row: TemplateRow, s: RowState): StarterItemInput {
  const suggested = row.candidates[0];
  const base = { clientRef: row.key, templateItemName: row.templateName };
  if (!s.keep) return { ...base, outcome: "removed", ...(suggested && { suggestedQid: suggested.qid }) };

  const price = s.price.trim();
  const openingQuantity = s.opening.trim() === "" ? undefined : Number(s.opening);
  if (s.choice === OWN) {
    return {
      ...base,
      outcome: "new_item",
      ...(suggested && { suggestedQid: suggested.qid, suggestedScore: Math.min(1, suggested.score) }),
      name: s.ownName.trim(),
      price,
      openingQuantity,
    };
  }
  const picked = row.candidates.find((c) => c.qid === s.choice)!;
  const accepted = picked.qid === suggested?.qid;
  return {
    ...base,
    outcome: accepted ? "accepted" : "corrected",
    suggestedQid: suggested!.qid,
    ...(suggested!.score > 0 && { suggestedScore: Math.min(1, suggested!.score) }),
    ...(!accepted && { qid: picked.qid }),
    name: picked.name,
    variantLabel: picked.variantLabel ?? undefined,
    sizeValue: picked.sizeValue ?? undefined,
    sizeUnit: picked.sizeUnit ?? undefined,
    packQty: picked.packQty,
    categoryPath: picked.categoryPath,
    price,
    openingQuantity,
  };
}
