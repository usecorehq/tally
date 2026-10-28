/**
 * "Does this merchant already have it?" — answered in Tally against the
 * business's own items; Qore Catalog never sees merchant inventory. Pure, no IO.
 * Checked in this order (store first, then catalogue):
 *
 *   reading   → the camera read exactly this before and the merchant confirmed
 *               it as this item (inventory_item_readings). Works for products
 *               the catalogue doesn't know.
 *   catalogue → an active item is linked to one of the plausible candidates'
 *               Qore IDs: "in stock", never a duplicate. Sure only when that
 *               candidate also agrees on size (/v1/match signals.size = 1);
 *               otherwise "is this your X?" — Peak 900g on the shelf must not
 *               restock the merchant's Peak 400g.
 *   catalogue + archived → only an archived item has that Qore ID: "you
 *               removed X, restore?" (restoring keeps its name, price, history).
 *               Same size rule.
 *   name      → a hand-typed item (no Qore ID) whose name holds the brand and
 *               name read off the pack: "is this your X?". Never sure. Needs a
 *               legible brand, exactly one such item and no conflicting size.
 *
 * Within each step, a size-agreeing candidate beats a better-scored one that
 * doesn't; otherwise candidates keep /v1/match's order.
 */

export type InventoryMatch = "reading" | "catalogue" | "name";

type Item = { id: string; name: string; variantLabel: string | null; coreQid: string | null };

export type InventoryIndex = {
  byQid: Map<string, string>;
  archivedByQid: Map<string, string>;
  byReading: Map<string, string>;
  /** Active items without a Qore ID, for name matching. */
  unlinked: { id: string; name: string; variantLabel: string | null }[];
};

export type Reading = { brand: string; name: string; pack: string };

/** sure = false: ask the merchant to confirm before treating it as in stock. */
export type StockedMatch = { itemId: string; match: InventoryMatch; archived: boolean; sure: boolean };

/** A plausible catalogue candidate, best first; sizeAgrees = /v1/match signals.size === 1. */
export type CandidateRef = { qid: string; sizeAgrees: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").replace(/\s+/g, " ").trim();

/** "brand|name|pack", lower-case, punctuation folded: the inventory_item_readings key. */
export function readingKey({ brand, name, pack }: Reading): string {
  return [brand, name, pack].map(norm).join("|");
}

/** active: the business's live items; archived: its archived items that carry a Qore ID. */
export function indexInventory(
  active: Item[],
  readings: { itemId: string; readingKey: string }[],
  archived: Item[] = [],
): InventoryIndex {
  const live = new Set(active.map((i) => i.id));
  const byQid = new Map(active.filter((i) => i.coreQid).map((i) => [i.coreQid!, i.id]));
  return {
    byQid,
    // Several archived copies of one product: any will do; an active one always wins.
    archivedByQid: new Map(archived.filter((i) => i.coreQid && !byQid.has(i.coreQid)).map((i) => [i.coreQid!, i.id])),
    byReading: new Map(readings.filter((r) => live.has(r.itemId)).map((r) => [r.readingKey, r.itemId])),
    unlinked: active.filter((i) => !i.coreQid).map(({ id, name, variantLabel }) => ({ id, name, variantLabel })),
  };
}

export function matchInventory(reading: Reading, candidates: CandidateRef[], index: InventoryIndex): StockedMatch | null {
  const byReading = index.byReading.get(readingKey(reading));
  if (byReading) return { itemId: byReading, match: "reading", archived: false, sure: true };

  // Size-agreeing candidates first (stable, so /v1/match order holds within each group).
  const ordered = [...candidates.filter((c) => c.sizeAgrees), ...candidates.filter((c) => !c.sizeAgrees)];
  for (const [items, archived] of [[index.byQid, false], [index.archivedByQid, true]] as const) {
    for (const c of ordered) {
      const itemId = items.get(c.qid);
      if (itemId) return { itemId, match: "catalogue", archived, sure: c.sizeAgrees };
    }
  }

  const byName = matchByName(reading, index.unlinked);
  return byName ? { itemId: byName, match: "name", archived: false, sure: false } : null;
}

const SIZE = /^\d+(?:\.\d+)?(?:g|kg|mg|ml|cl|l|ltr|oz|lb|pcs|pc|x)?$/;
// "400 g" and "400g" are the same size.
const tokens = (s: string) =>
  norm(s)
    .replace(/(\d) (g|kg|mg|ml|cl|l|ltr|oz|lb)\b/g, "$1$2")
    .split(" ")
    .filter(Boolean);
const sizes = (ts: string[]) => ts.filter((t) => SIZE.test(t) && /\d/.test(t));

function matchByName(reading: Reading, items: InventoryIndex["unlinked"]): string | null {
  if (!reading.brand) return null;
  const wanted = [...new Set([...tokens(reading.brand), ...tokens(reading.name)])].filter((t) => !SIZE.test(t));
  if (wanted.length === 0) return null;
  const packSizes = sizes(tokens(reading.pack));

  const hits = items.filter((item) => {
    const have = tokens(`${item.name} ${item.variantLabel ?? ""}`);
    if (!wanted.every((t) => have.includes(t))) return false;
    const itemSizes = sizes(have);
    // Both state a size and they differ: a different pack of the same product.
    return packSizes.length === 0 || itemSizes.length === 0 || packSizes.some((s) => itemSizes.includes(s));
  });
  return hits.length === 1 ? hits[0]!.id : null;
}
