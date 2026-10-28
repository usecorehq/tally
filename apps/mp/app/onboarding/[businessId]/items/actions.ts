"use server";

import { api, errorMessage } from "@/lib/api";
import type { StarterItemInput, StarterResult } from "../../_lib/starter";

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
