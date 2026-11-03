import "server-only";
import { auth } from "@/auth";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api").replace(/\/$/, "");

/** A non-2xx from Tally's API. `message` is the API's own (safe to show); `code` is its machine code, if any. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Server-side call to Tally's apps/api with the signed-in user's Supabase
 * token. Never import into a client component: the token stays on the server.
 */
export async function api<T>(path: string, init: RequestInit & { json?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const { json, timeoutMs = 20_000, headers, ...rest } = init;
  const session = await auth();
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      ...(session?.accessToken && { Authorization: `Bearer ${session.accessToken}` }),
      ...(json !== undefined && { "content-type": "application/json" }),
      ...headers,
    },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { message?: string | string[]; code?: string; error?: string; error_description?: string }
      | null;
    const message = Array.isArray(body?.message) ? body.message.join("; ") : (body?.message ?? body?.error_description);
    // OAuth endpoints answer RFC 6749 bodies: their `error` is the code.
    throw new ApiError(res.status, message ?? `Request failed (${res.status})`, body?.code ?? body?.error);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** A user-facing message for any failure from api(). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status < 500) return err.message;
  if (err instanceof ApiError && err.status === 503) return "The catalogue is busy. Try again in a moment.";
  return "Something went wrong on our side. Try again.";
}
