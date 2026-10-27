"use server";

import { api, errorMessage } from "@/lib/api";

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

export async function submitStarter(
  businessId: string,
  items: StarterItemInput[],
): Promise<{ ok: true; result: StarterResult } | { ok: false; error: string }> {
  try {
    const result = await api<StarterResult>(`/businesses/${businessId}/inventory/starter`, {
      method: "POST",
      json: { items },
      timeoutMs: 60_000,
    });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
