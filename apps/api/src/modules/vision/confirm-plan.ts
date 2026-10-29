/**
 * Shelf-scan confirm, catalogue side (restock / restore / add / skip); the inventory side runs in VisionService.
 * Feedback: top candidate → accepted, another Qore ID → corrected, none → new_item, skip → removed.
 */
import type { FeedbackItem, FeedbackOutcome } from "@tally/catalog-client";

export const CONFIRM_ACTIONS = ["restock", "restore", "add", "skip"] as const;
export type ConfirmAction = (typeof CONFIRM_ACTIONS)[number];

export function outcomeFor(action: ConfirmAction, confirmedQid: string | null, topQid: string | null): FeedbackOutcome {
  if (action === "skip") return "removed";
  if (!confirmedQid) return "new_item";
  return confirmedQid === topQid ? "accepted" : "corrected";
}

/** clientRef for /v1/feedback (and later /v1/images): stable per detection, so retries dedupe. */
export const feedbackRef = (scanId: string, position: number) => `${scanId}:${position}`;

export type DecidedDetection = {
  scanId: string;
  position: number;
  brand: string;
  name: string;
  pack: string;
  candidates: { qid: string; score: number }[];
  outcome: FeedbackOutcome;
  confirmedQid: string | null;
  quantity: number | null;
  /** The item's name, for new_item. */
  itemName: string | null;
  /** The item's price as stored (Naira string), when there is one. */
  price: string | null;
};

export function feedbackFor(d: DecidedDetection, businessId: string, subtypeCode: string): FeedbackItem {
  const top = d.candidates[0];
  return {
    clientRef: feedbackRef(d.scanId, d.position),
    businessRef: businessId,
    subtypeCode,
    source: "photo",
    input: { ...(d.brand && { brand: d.brand }), name: d.name, ...(d.pack && { pack: d.pack }) },
    ...(top && { suggestedQid: top.qid, suggestedScore: top.score }),
    outcome: d.outcome,
    ...(d.confirmedQid && d.outcome !== "removed" && { confirmedQid: d.confirmedQid }),
    ...(d.outcome === "new_item" && d.itemName && { confirmedName: d.itemName }),
    // The catalogue validates both as whole numbers: units, and whole Naira.
    ...(d.outcome !== "removed" && d.quantity !== null && { quantity: d.quantity }),
    ...(d.outcome !== "removed" && d.price !== null && { unitPriceNgn: Math.round(Number(d.price)) }),
  };
}
