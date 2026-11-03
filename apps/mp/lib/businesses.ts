import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { api } from "./api";
import { BUSINESS_COOKIE } from "./business-cookie";

export type BusinessSummary = { id: string; name: string; subtypeCode: string; role: string };

/** The signed-in user's businesses, read once per request; null when the read failed. */
export const listBusinesses = cache(async (): Promise<BusinessSummary[] | null> => {
  try {
    return await api<BusinessSummary[]>("/businesses");
  } catch {
    return null;
  }
});

/** The current business: ?business= first, then the one last switched to, then the first. */
export async function pickBusiness<T extends { id: string }>(businesses: T[], requested?: string | null): Promise<T | undefined> {
  const saved = (await cookies()).get(BUSINESS_COOKIE)?.value;
  return businesses.find((b) => b.id === requested) ?? businesses.find((b) => b.id === saved) ?? businesses[0];
}
