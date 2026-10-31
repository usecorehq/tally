import "server-only";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { listBusinesses, pickBusiness } from "@/lib/businesses";
import type { SettingsBusiness } from "./types";

/** The current business, as the top-bar switcher picks it; null when the read failed. No businesses → onboarding. */
export async function loadCurrentBusiness(requested: string | undefined): Promise<SettingsBusiness | null> {
  const list = await listBusinesses();
  if (!list) return null;
  if (list.length === 0) redirect("/onboarding");
  const { id, name, role } = (await pickBusiness(list, requested))!;
  return { id, name, role };
}

/** Reads that may fail on their own: null is shown as failed with "–" figures, never as empty. */
export async function tryApi<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch {
    return null;
  }
}
