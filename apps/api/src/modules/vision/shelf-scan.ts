import { randomUUID } from "node:crypto";
import type { MatchCandidate, MatchItem, MatchResult } from "@tally/catalog-client";
import { matchInventory, type CandidateRef, type InventoryIndex, type InventoryMatch, type StockedMatch } from "./inventory-match";
import type { Box, Confidence, ShelfProduct } from "./shelf-reader";

export const MATCH_CANDIDATES = 3;
/** Asked of /v1/match (max 10): enough that filtering still leaves the right one. */
export const MATCH_LIMIT = 10;

/**
 * Unbranded reads must match on meaning via /v1/match's text signal (not score, which an agreeing size inflates).
 * 0.50 was the measured cut-off between right- and wrong-type matches; these stay suggestions the merchant confirms.
 */
export const MIN_UNBRANDED_TEXT = 0.5;

/**
 * Drops the lookalikes /v1/match returns when the catalogue lacks a brand: a read brand must match
 * (signals.brand = 1), otherwise signals.text must reach MIN_UNBRANDED_TEXT.
 */
export function plausible(product: Pick<ShelfProduct, "brand">, candidate: MatchCandidate): boolean {
  return product.brand ? candidate.signals.brand === 1 : candidate.signals.text >= MIN_UNBRANDED_TEXT;
}

/**
 * Candidate fit: strong = brand and size agree; medium = brand agrees, or no brand read but the name matches well;
 * low = barely plausible. Clients pre-fill strong and medium only; a low top candidate defaults to "new item".
 */
export type MatchStrength = "strong" | "medium" | "low";

/** No brand read: the name must match at least this well (signals.text) to count as medium. */
export const MEDIUM_UNBRANDED_TEXT = 0.7;

export function matchStrength(signals: MatchCandidate["signals"]): MatchStrength {
  if (signals.brand === 1 && signals.size === 1) return "strong";
  if (signals.brand === 1) return "medium";
  // brand 0.5 = the label gave no brand; 0 = a different brand (never plausible, but be safe).
  return signals.brand === 0.5 && signals.text >= MEDIUM_UNBRANDED_TEXT ? "medium" : "low";
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
  match: MatchStrength;
  /** The catalogue's approved picture; null until a curator approves one (show the crop or a placeholder). */
  image: { url: string; width: number | null; height: number | null } | null;
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
  /**
   * Ask "Is this your X?" before treating it as in stock. false only for a remembered reading
   * or a catalogue match whose size agrees with the label.
   */
  inventoryNeedsConfirm: boolean;
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
 * Joins Spark's products with plausible catalogue candidates and the business's inventory. No candidate
 * means the catalogue lacks it: the merchant adds their own item, which feeds back as new_item.
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
    const plausibleCandidates = (byRef.get(String(i))?.candidates ?? []).filter((c) => plausible(p, c));
    const candidates = plausibleCandidates.slice(0, MATCH_CANDIDATES).map((c) => toCandidate(c, inventory));
    return {
      id: newId(),
      brand: p.brand,
      name: p.name,
      pack: p.pack,
      look: p.look,
      ...counted(p, samBoxes.get(i)),
      confidence: p.confidence,
      candidates,
      // All plausible candidates, not just the 3 shown: the merchant's size may rank lower.
      ...stocked(matchInventory(p, candidateRefs(plausibleCandidates), inventory)),
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

function stocked(
  m: StockedMatch | null,
): Pick<Detection, "inventoryItemId" | "inventoryMatch" | "inventoryItemArchived" | "inventoryNeedsConfirm"> {
  return m
    ? { inventoryItemId: m.itemId, inventoryMatch: m.match, inventoryItemArchived: m.archived, inventoryNeedsConfirm: !m.sure }
    : { inventoryItemId: null, inventoryMatch: null, inventoryItemArchived: false, inventoryNeedsConfirm: false };
}

export function toCandidate(c: MatchCandidate, inventory: InventoryIndex): DetectionCandidate {
  return {
    qid: c.qid,
    name: c.name,
    brand: c.brand?.name ?? null,
    variantLabel: c.variantLabel,
    size: c.size,
    packQty: c.packQty,
    score: c.score,
    price: c.price ? { median: c.price.median, min: c.price.min, max: c.price.max } : null,
    inventoryItemId: inventory.byQid.get(c.qid) ?? null,
    match: matchStrength(c.signals),
    image: c.image ?? null,
  };
}

/** Sure only when the label's brand and size both agree; an unbranded read always asks. */
export function candidateRefs(candidates: MatchCandidate[]): CandidateRef[] {
  return candidates.map((c) => ({ qid: c.qid, sizeAgrees: c.signals.brand === 1 && c.signals.size === 1 }));
}
