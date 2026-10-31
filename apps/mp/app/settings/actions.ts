"use server";

import { revalidatePath } from "next/cache";
import { api, errorMessage } from "@/lib/api";
import type { ActionResult, Subscription } from "./_lib/types";

/** Revoke a connected app: its tokens stop working within a minute (the API's grant cache). */
export async function revokeGrant(grantId: string): Promise<ActionResult> {
  try {
    await api<void>(`/clients/v1/grants/${encodeURIComponent(grantId)}`, { method: "DELETE" });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath("/settings", "layout");
  return { ok: true };
}

/** Simulated: switches the plan with no payment, and creates no revenue. */
export async function subscribe(businessId: string, planCode: string): Promise<ActionResult> {
  try {
    await api<Subscription>(`/businesses/${encodeURIComponent(businessId)}/subscription`, { method: "POST", json: { plan_code: planCode } });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath("/settings", "layout");
  return { ok: true };
}
