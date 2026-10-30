import "server-only";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { SettingsBusiness } from "./types";

/**
 * The user's businesses and the one in ?business= (else the first), as the stock-take pages pick it.
 * null when the read failed; no businesses → onboarding.
 */
export async function loadSettingsBusinesses(
  requested: string | undefined,
): Promise<{ businesses: SettingsBusiness[]; current: SettingsBusiness } | null> {
  let businesses: SettingsBusiness[];
  try {
    businesses = (await api<SettingsBusiness[]>("/businesses")).map(({ id, name, role }) => ({ id, name, role }));
  } catch {
    return null;
  }
  if (businesses.length === 0) redirect("/onboarding");
  return { businesses, current: businesses.find((b) => b.id === requested) ?? businesses[0]! };
}

/** Reads that may fail on their own: null is shown as failed with "–" figures, never as empty. */
export async function tryApi<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch {
    return null;
  }
}
