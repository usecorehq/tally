import { randomUUID } from "node:crypto";
import type { MatchItem, MatchResult } from "@tally/catalog-client";
import type { Box, Confidence, ShelfProduct } from "./shelf-reader";

export const MATCH_CANDIDATES = 3;

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
  count: number;
  /** 0–1000 grid of the uploaded image, one per visible unit. */
  boxes: Box[];
  confidence: Confidence;
  candidates: DetectionCandidate[];
  /** Top candidate's inventory item: confirming this detection restocks it. */
  inventoryItemId: string | null;
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

/** Join Spark's products with their catalogue candidates and the business's inventory (by Qore ID). */
export function buildDetections(
  products: ShelfProduct[],
  matches: MatchResult[],
  inventoryByQid: Map<string, string>,
  newId: () => string = randomUUID,
): Detection[] {
  const byRef = new Map(matches.map((m) => [m.ref, m]));
  return products.map((p, i) => {
    const candidates = (byRef.get(String(i))?.candidates ?? []).slice(0, MATCH_CANDIDATES).map(
      (c): DetectionCandidate => ({
        qid: c.qid,
        name: c.name,
        brand: c.brand?.name ?? null,
        variantLabel: c.variantLabel,
        size: c.size,
        packQty: c.packQty,
        score: c.score,
        price: c.price ? { median: c.price.median, min: c.price.min, max: c.price.max } : null,
        inventoryItemId: inventoryByQid.get(c.qid) ?? null,
      }),
    );
    return {
      id: newId(),
      brand: p.brand,
      name: p.name,
      pack: p.pack,
      count: p.count,
      boxes: p.boxes,
      confidence: p.confidence,
      candidates,
      inventoryItemId: candidates[0]?.inventoryItemId ?? null,
    };
  });
}
