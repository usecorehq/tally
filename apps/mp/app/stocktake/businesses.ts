import "server-only";
import { redirect } from "next/navigation";
import { listBusinesses, pickBusiness } from "@/lib/businesses";

export type Business = { id: string; name: string };

/**
 * The signed-in user's businesses and the current one (?business=, else the last switched to, else the first);
 * null when the read failed. No businesses yet → onboarding.
 */
export async function loadBusinesses(requested: string | undefined): Promise<{ businesses: Business[]; current: Business } | null> {
  const list = await listBusinesses();
  if (!list) return null;
  if (list.length === 0) redirect("/onboarding");
  const businesses = list.map(({ id, name }) => ({ id, name }));
  return { businesses, current: (await pickBusiness(businesses, requested))! };
}
