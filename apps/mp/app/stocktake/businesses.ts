import "server-only";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";

export type Business = { id: string; name: string };

/**
 * The signed-in user's businesses and the one in ?business= (else the first); null when the read failed.
 * No businesses yet → onboarding.
 */
export async function loadBusinesses(requested: string | undefined): Promise<{ businesses: Business[]; current: Business } | null> {
  let businesses: Business[];
  try {
    businesses = (await api<{ id: string; name: string }[]>("/businesses")).map(({ id, name }) => ({ id, name }));
  } catch {
    return null;
  }
  if (businesses.length === 0) redirect("/onboarding");
  return { businesses, current: businesses.find((b) => b.id === requested) ?? businesses[0]! };
}
