/**
 * "Does this merchant already have it?", answered in Tally against its own items. Pure, no IO. Checked in order:
 * remembered branded reading, linked Qore ID (active, then archived), hand-typed name; sure only when sizes agree.
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

/** A plausible catalogue candidate, best first. sizeAgrees: /v1/match says both brand and size match the label. */
export type CandidateRef = { qid: string; sizeAgrees: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").replace(/\s+/g, " ").trim();

/** "brand|name|pack", lower-case, punctuation folded: the inventory_item_readings key. */
export function readingKey({ brand, name, pack }: Reading): string {
  return [brand, name, pack].map(norm).join("|");
}

/** Only a reading with a legible brand is specific enough to remember and trust. */
export const rememberable = ({ brand }: Reading): boolean => norm(brand).length > 0;

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
  const byReading = rememberable(reading) ? index.byReading.get(readingKey(reading)) : undefined;
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
