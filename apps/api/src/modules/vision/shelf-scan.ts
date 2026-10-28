import { randomUUID } from "node:crypto";
import type { MatchCandidate, MatchItem, MatchResult } from "@tally/catalog-client";
import { matchInventory, type InventoryIndex, type InventoryMatch, type StockedMatch } from "./inventory-match";
import type { Box, Confidence, ShelfProduct } from "./shelf-reader";

export const MATCH_CANDIDATES = 3;
/** Asked of /v1/match (max 10): enough that filtering still leaves the right one. */
export const MATCH_LIMIT = 10;

/** Without a legible brand, only near-exact name matches are worth showing. */
export const MIN_UNBRANDED_SCORE = 0.75;

/**
 * Drop catalogue candidates the merchant shouldn't be offered. /v1/match always
 * returns its nearest products, so a brand the catalogue lacks comes back as
 * another brand's lookalike (live: "Lady B Custard Powder" → a laundry detergent).
 *   brand read     → keep only candidates whose brand matched (signals.brand = 1)
 *   brand not read → keep only candidates scoring ≥ MIN_UNBRANDED_SCORE
 */
export function plausible(product: ShelfProduct, candidate: MatchCandidate): boolean {
  return product.brand ? candidate.signals.brand === 1 : candidate.score >= MIN_UNBRANDED_SCORE;
}

export type DetectionCandidate = {
  qid: string;
  name: string;
  brand: string | null;
  variantLabel: string | null;
  size: { value: number; unit: string } | null;
  packQty: number;
  score: number;
  /** Indicative catalogue price in whole Naira; not a sale amount. */
  price: { median: number; min: number; max: number } | null;
  /** This business's active item for this product, when it already stocks it. */
  inventoryItemId: string | null;
};

export type Detection = {
  id: string;
  brand: string;
  name: string;
  pack: string;
  /** The visual phrase SAM counted with, e.g. "red toothpaste box". */
  look: string;
  /** samCount when SAM found this product's units, else sparkCount. */
  count: number;
  countSource: "sam" | "spark";
  sparkCount: number;
  /** null when SAM didn't run for this product (too many looks, or SAM failed). */
  samCount: number | null;
  /** 0–1000 grid of the uploaded image, one per counted unit (SAM's when it counted). */
  boxes: Box[];
  confidence: Confidence;
  candidates: DetectionCandidate[];
  /** The business's item this looks like: confirming the detection restocks it. */
  inventoryItemId: string | null;
  /** How that item was found; null when the merchant doesn't seem to stock it. */
  inventoryMatch: InventoryMatch | null;
  /** The match is an item the merchant removed: offer to restore it rather than add a duplicate. */
  inventoryItemArchived: boolean;
};

/** One /v1/match item per product, ref = its index, so results map back without relying on order. */
export function matchItems(products: ShelfProduct[]): MatchItem[] {
  return products.map((p, i) => ({
    ref: String(i),
    ...(p.brand ? { brand: p.brand } : {}),
    name: p.name,
    ...(p.pack ? { pack: p.pack } : {}),
  }));
}

/**
 * Join Spark's products with their plausible catalogue candidates and the
 * business's own inventory (see inventory-match.ts). No candidate = the
 * catalogue doesn't have it; the merchant adds it as their own item, which
 * feeds back as new_item.
 */
export function buildDetections(
  products: ShelfProduct[],
  matches: MatchResult[],
  inventory: InventoryIndex,
  samBoxes: Map<number, Box[]> = new Map(),
  newId: () => string = randomUUID,
): Detection[] {
  const byRef = new Map(matches.map((m) => [m.ref, m]));
  return products.map((p, i) => {
    const candidates = (byRef.get(String(i))?.candidates ?? [])
      .filter((c) => plausible(p, c))
      .slice(0, MATCH_CANDIDATES)
      .map((c): DetectionCandidate => ({
        qid: c.qid,
        name: c.name,
        brand: c.brand?.name ?? null,
        variantLabel: c.variantLabel,
        size: c.size,
        packQty: c.packQty,
        score: c.score,
        price: c.price ? { median: c.price.median, min: c.price.min, max: c.price.max } : null,
        inventoryItemId: inventory.byQid.get(c.qid) ?? null,
      }));
    return {
      id: newId(),
      brand: p.brand,
      name: p.name,
      pack: p.pack,
      look: p.look,
      ...counted(p, samBoxes.get(i)),
      confidence: p.confidence,
      candidates,
      ...stocked(matchInventory(p, candidates.map((c) => c.qid), inventory)),
    };
  });
}

/** SAM's count wins when it found at least one unit; zero means SAM missed it, not that it isn't there. */
function counted(p: ShelfProduct, sam: Box[] | undefined): Pick<Detection, "count" | "countSource" | "sparkCount" | "samCount" | "boxes"> {
  const samCount = sam ? sam.length : null;
  return samCount
    ? { count: samCount, countSource: "sam", sparkCount: p.count, samCount, boxes: sam! }
    : { count: p.count, countSource: "spark", sparkCount: p.count, samCount, boxes: p.boxes };
}

function stocked(m: StockedMatch | null): Pick<Detection, "inventoryItemId" | "inventoryMatch" | "inventoryItemArchived"> {
  return m
    ? { inventoryItemId: m.itemId, inventoryMatch: m.match, inventoryItemArchived: m.archived }
    : { inventoryItemId: null, inventoryMatch: null, inventoryItemArchived: false };
}
