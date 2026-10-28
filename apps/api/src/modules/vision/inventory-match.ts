/**
 * "Does this merchant already have it?" — answered in Tally against the
 * business's own items, never by Qore Catalog. Pure, no IO.
 *
 *   reading   → the camera read exactly this before and the merchant confirmed
 *               it as this item (inventory_item_readings). Strongest: works for
 *               products the catalogue doesn't know.
 *   catalogue → the top plausible catalogue candidate is linked to an item.
 *   name      → brand and name read off the pack appear in one item's name.
 *               Conservative: needs a legible brand, a single matching item and
 *               no conflicting pack size.
 */

export type InventoryMatch = "reading" | "catalogue" | "name";

export type InventoryIndex = {
  byQid: Map<string, string>;
  byReading: Map<string, string>;
  items: { id: string; name: string; variantLabel: string | null }[];
};

export type Reading = { brand: string; name: string; pack: string };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").replace(/\s+/g, " ").trim();

/** "brand|name|pack", lower-case, punctuation folded: the inventory_item_readings key. */
export function readingKey({ brand, name, pack }: Reading): string {
  return [brand, name, pack].map(norm).join("|");
}

export function indexInventory(
  items: { id: string; name: string; variantLabel: string | null; coreQid: string | null }[],
  readings: { itemId: string; readingKey: string }[],
): InventoryIndex {
  const live = new Set(items.map((i) => i.id));
  return {
    byQid: new Map(items.filter((i) => i.coreQid).map((i) => [i.coreQid!, i.id])),
    byReading: new Map(readings.filter((r) => live.has(r.itemId)).map((r) => [r.readingKey, r.itemId])),
    items: items.map(({ id, name, variantLabel }) => ({ id, name, variantLabel })),
  };
}

export function matchInventory(
  reading: Reading,
  topQid: string | null,
  index: InventoryIndex,
): { itemId: string; match: InventoryMatch } | null {
  const byReading = index.byReading.get(readingKey(reading));
  if (byReading) return { itemId: byReading, match: "reading" };

  const byQid = topQid ? index.byQid.get(topQid) : undefined;
  if (byQid) return { itemId: byQid, match: "catalogue" };

  const byName = matchByName(reading, index.items);
  return byName ? { itemId: byName, match: "name" } : null;
}

const SIZE = /^\d+(?:\.\d+)?(?:g|kg|mg|ml|cl|l|ltr|oz|lb|pcs|pc|x)?$/;
// "400 g" and "400g" are the same size.
const tokens = (s: string) =>
  norm(s)
    .replace(/(\d) (g|kg|mg|ml|cl|l|ltr|oz|lb)\b/g, "$1$2")
    .split(" ")
    .filter(Boolean);
const sizes = (ts: string[]) => ts.filter((t) => SIZE.test(t) && /\d/.test(t));

function matchByName(reading: Reading, items: InventoryIndex["items"]): string | null {
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
