"use server";

import { redirect } from "next/navigation";
import { api, errorMessage } from "@/lib/api";

export type CreateBusinessState = { error?: string; fields?: { name?: string; subtypeCode?: string } };

export async function createBusiness(_prev: CreateBusinessState, form: FormData): Promise<CreateBusinessState> {
  const name = String(form.get("name") ?? "").trim();
  const subtypeCode = String(form.get("subtypeCode") ?? "");
  const fields = { name, subtypeCode };

  let businessId: string;
  try {
    const business = await api<{ id: string }>("/businesses", { method: "POST", json: { name, subtypeCode } });
    businessId = business.id;
  } catch (err) {
    return { error: errorMessage(err), fields };
  }
  redirect(`/onboarding/${businessId}/items`);
}
