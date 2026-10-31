"use server";

import { revalidatePath } from "next/cache";
import { api, errorMessage } from "@/lib/api";
import type { AppResult, DeveloperApp, WithSecret } from "./_lib/developer";

type AppInput = { name?: string; logo_url?: string | null; redirect_uris?: string[]; allowed_origins?: string[]; scopes?: string[] };

const path = (clientId: string) => `/clients/v1/apps/${encodeURIComponent(clientId)}`;

async function call<T>(run: () => Promise<T>): Promise<AppResult<T>> {
  try {
    const data = await run();
    revalidatePath("/settings/developers", "layout");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** The secret comes back once, in this result only; nothing here stores it. */
export async function createApp(input: AppInput): Promise<AppResult<WithSecret>> {
  return call(() => api<WithSecret>("/clients/v1/apps", { method: "POST", json: input }));
}

export async function updateApp(clientId: string, input: AppInput): Promise<AppResult<DeveloperApp>> {
  return call(() => api<DeveloperApp>(path(clientId), { method: "PATCH", json: input }));
}

/** The old secret stops working at once. */
export async function rotateSecret(clientId: string): Promise<AppResult<WithSecret>> {
  return call(() => api<WithSecret>(`${path(clientId)}/rotate-secret`, { method: "POST" }));
}

/** Also disconnects every business; only Qorelly can reactivate the app. */
export async function suspendApp(clientId: string): Promise<AppResult<DeveloperApp>> {
  return call(() => api<DeveloperApp>(`${path(clientId)}/suspend`, { method: "POST" }));
}
