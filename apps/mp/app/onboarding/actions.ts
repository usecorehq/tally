"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BUSINESS_COOKIE, BUSINESS_COOKIE_MAX_AGE } from "@/lib/business-cookie";
import type { SubtypeTemplates } from "@tally/catalog-client";
import { api, errorMessage } from "@/lib/api";
import { toRows, type StarterItemInput, type StarterResult, type TemplateRow } from "./_lib/starter";

/** Template items for a sub-type. Needs no business, so the wizard can show them before anything is saved. */
export async function loadStarterRows(
  subtypeCode: string,
): Promise<{ ok: true; rows: TemplateRow[] } | { ok: false; error: string }> {
  try {
    // First call per sub-type takes ~5 s (catalogue suggestions).
    const templates = await api<SubtypeTemplates>(
      `/catalog/subtypes/${encodeURIComponent(subtypeCode)}/templates?suggestions=2`,
      { timeoutMs: 30_000 },
    );
    return { ok: true, rows: toRows(templates) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type FinishInput = {
  /** Set when an earlier attempt created the business but the starter items failed: retry only those. */
  businessId?: string;
  name: string;
  subtypeCode: string;
  items: StarterItemInput[];
};

export type FinishResult =
  | { ok: true; result: StarterResult }
  | { ok: false; error: string; businessId?: string };

/**
 * "Finish setup" / "Skip & finish": the business is created only here, as in Qorelly's /setup,
 * so going Back never leaves a half-made business behind. No items → straight to the dashboard.
 */
export async function finishSetup(input: FinishInput): Promise<FinishResult> {
  const name = input.name.trim();
  if (!name || !input.subtypeCode) return { ok: false, error: "Enter your business name and type." };

  let businessId = input.businessId;
  if (!businessId) {
    try {
      const business = await api<{ id: string }>("/businesses", {
        method: "POST",
        json: { name, subtypeCode: input.subtypeCode },
      });
      businessId = business.id;
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
    // The new business is the one the app opens on next.
    (await cookies()).set(BUSINESS_COOKIE, businessId, { path: "/", maxAge: BUSINESS_COOKIE_MAX_AGE, sameSite: "lax" });
  }

  if (input.items.length === 0) redirect("/");

  try {
    const result = await api<StarterResult>(`/businesses/${businessId}/inventory/starter`, {
      method: "POST",
      json: { items: input.items },
      timeoutMs: 60_000,
    });
    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      businessId,
      error: `${name} was created, but we couldn't add your starter items. ${errorMessage(err)}`,
    };
  }
}
