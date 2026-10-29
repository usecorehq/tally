import type { FeedbackItem } from "@tally/catalog-client";
import type { schema } from "@tally/db";

type NewInventoryItem = schema.NewInventoryItem;
import type { StarterItem } from "./businesses.dto";

export type StarterPlan = {
  /** Rows to insert, keyed by the item's clientRef. */
  items: { clientRef: string; row: NewInventoryItem; openingQuantity: number }[];
  /** One feedback entry per template decision, kept or removed. */
  feedback: FeedbackItem[];
  /** Items that can't be applied, with the reason. */
  invalid: { clientRef: string; reason: string }[];
};

/**
 * Turns template choices (accepted / corrected / new_item / removed) into inventory rows and catalogue feedback.
 * Pure, so the catalogue's feedback rules live in one tested place.
 */
export function planStarterInventory(
  businessId: string,
  subtypeCode: string,
  input: StarterItem[],
): StarterPlan {
  const plan: StarterPlan = { items: [], feedback: [], invalid: [] };
  const seen = new Set<string>();

  for (const item of input) {
    if (seen.has(item.clientRef)) {
      plan.invalid.push({ clientRef: item.clientRef, reason: "duplicate clientRef in request" });
      continue;
    }
    seen.add(item.clientRef);

    const coreQid = qidFor(item);
    if (coreQid === undefined) {
      plan.invalid.push({ clientRef: item.clientRef, reason: missingQidReason(item.outcome) });
      continue;
    }

    if (item.outcome !== "removed") {
      if (!item.name || item.price === undefined) {
        plan.invalid.push({ clientRef: item.clientRef, reason: "name and price are required unless removed" });
        continue;
      }
      plan.items.push({
        clientRef: item.clientRef,
        openingQuantity: item.openingQuantity ?? 0,
        row: {
          businessId,
          coreQid,
          name: item.name,
          variantLabel: item.variantLabel ?? null,
          sizeValue: item.sizeValue === undefined ? null : String(item.sizeValue),
          sizeUnit: item.sizeUnit ?? null,
          packQty: item.packQty ?? 1,
          categoryPath: item.categoryPath ?? null,
          price: item.price,
          source: "template",
        },
      });
    }

    plan.feedback.push({
      clientRef: item.clientRef,
      businessRef: businessId,
      subtypeCode,
      source: "template",
      input: { name: item.templateItemName },
      ...(item.suggestedQid && { suggestedQid: item.suggestedQid }),
      ...(item.suggestedScore !== undefined && { suggestedScore: item.suggestedScore }),
      outcome: item.outcome,
      ...(item.outcome === "corrected" && { confirmedQid: item.qid }),
      // The catalogue needs suggestedQid or confirmedQid for an accept.
      ...(item.outcome === "accepted" && !item.suggestedQid && { confirmedQid: item.qid }),
      ...(item.outcome === "new_item" && { confirmedName: item.name }),
      // The catalogue validates both as whole numbers: price in whole Naira, quantity in units.
      ...(item.outcome !== "removed" && Number.isInteger(item.openingQuantity) && { quantity: item.openingQuantity }),
      ...(item.outcome !== "removed" && item.price !== undefined && { unitPriceNgn: Math.round(Number(item.price)) }),
    });
  }
  return plan;
}

/** The catalogue product to link, null for none, undefined when the input is inconsistent. */
function qidFor(item: StarterItem): string | null | undefined {
  switch (item.outcome) {
    case "accepted":
      return item.suggestedQid ?? item.qid ?? undefined;
    case "corrected":
      return item.qid ?? undefined;
    case "new_item":
    case "removed":
      return null;
  }
}

function missingQidReason(outcome: StarterItem["outcome"]): string {
  return outcome === "corrected" ? "corrected needs qid (the product picked)" : "accepted needs suggestedQid";
}
