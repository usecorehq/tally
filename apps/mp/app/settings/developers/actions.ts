"use server";

import { revalidatePath } from "next/cache";
import { api, errorMessage } from "@/lib/api";
import type { AppResult, DeveloperApp, Issued, WithSecret } from "./_lib/developer";
import { dropSecret, holdSecret, readSecret } from "./_lib/secret-store";

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

/** The secret goes into the server-held cookie; the result carries only the app and its mask. */
async function issue(run: () => Promise<WithSecret>): Promise<Issued> {
  const { client_secret, ...app } = await run();
  return { app, held: await holdSecret(app.client_id, client_secret) };
}

export async function createApp(input: AppInput): Promise<AppResult<Issued>> {
  return call(() => issue(() => api<WithSecret>("/clients/v1/apps", { method: "POST", json: input })));
}

export async function updateApp(clientId: string, input: AppInput): Promise<AppResult<DeveloperApp>> {
  return call(() => api<DeveloperApp>(path(clientId), { method: "PATCH", json: input }));
}

/** The old secret stops working at once. */
export async function rotateSecret(clientId: string): Promise<AppResult<Issued>> {
  return call(() => issue(() => api<WithSecret>(`${path(clientId)}/rotate-secret`, { method: "POST" })));
}

/** Also disconnects every business; only Qorelly can reactivate the app. */
export async function suspendApp(clientId: string): Promise<AppResult<DeveloperApp>> {
  return call(async () => {
    const app = await api<DeveloperApp>(`${path(clientId)}/suspend`, { method: "POST" });
    await dropSecret(clientId);
    return app;
  });
}

/** For a Copy click only: the held secret, any number of times until it expires or is dropped. */
export async function revealHeldSecret(clientId: string): Promise<AppResult<string>> {
  const secret = await readSecret(clientId);
  return secret ? { ok: true, data: secret } : { ok: false, error: "The secret is no longer held. Regenerate it to copy a new one." };
}

/** "Done, I've stored it": forget the secret now instead of in 10 minutes. */
export async function forgetHeldSecret(clientId: string): Promise<AppResult<null>> {
  try {
    await dropSecret(clientId);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
