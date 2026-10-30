// The embed's client lookup (GET /clients/v1/embed-config), shared by proxy.ts and the embed page.
// proxy.ts does the lookup, because only it can set the response's frame-ancestors header.

export type EmbedConfig = {
  client_id: string;
  name: string;
  status: "active" | "suspended";
  allowed_origins: string[];
  theme: unknown;
};

/** proxy.ts → page: the lookup's outcome, so the page never fetches it a second time. */
export const EMBED_CONFIG_HEADER = "x-tally-embed-config";

export type EmbedLookup = { ok: true; config: EmbedConfig } | { ok: false; reason: "unknown_client" | "unavailable" };

/** Dev and preview deploys only: the fixture client and the harness. */
export const fixturesAllowed = () => process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";

export const FIXTURE_CLIENT_ID = "tc_fixture00000000000000000";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api").replace(/\/$/, "");
const TTL_MS = 60_000;
const memo = new Map<string, { at: number; lookup: EmbedLookup }>();

/** The client's embed settings, kept at most 60 s; `origin` is this request's own, for the fixture. */
export async function lookupEmbedClient(clientId: string, origin: string): Promise<EmbedLookup> {
  if (fixturesAllowed() && clientId === FIXTURE_CLIENT_ID) {
    return { ok: true, config: { client_id: clientId, name: "Fixture client", status: "active", allowed_origins: [origin], theme: null } };
  }
  if (!/^tc_[a-z0-9]{24}$/.test(clientId)) return { ok: false, reason: "unknown_client" };
  const hit = memo.get(clientId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.lookup;
  let lookup: EmbedLookup;
  try {
    const res = await fetch(`${BASE}/clients/v1/embed-config?client_id=${encodeURIComponent(clientId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status === 404) lookup = { ok: false, reason: "unknown_client" };
    else if (!res.ok) return { ok: false, reason: "unavailable" };
    else lookup = { ok: true, config: (await res.json()) as EmbedConfig };
  } catch {
    // Not memoised: the next load tries again.
    return { ok: false, reason: "unavailable" };
  }
  memo.set(clientId, { at: Date.now(), lookup });
  return lookup;
}

/** Origins as the browser sends them (scheme://host[:port]); anything else never matches. */
export function normaliseOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** The frame-ancestors source list: valid origins only, never a wildcard. */
export function frameAncestors(config: EmbedConfig | null): string {
  const origins = (config?.allowed_origins ?? []).map(normaliseOrigin).filter((o): o is string => o !== null);
  return origins.length > 0 ? origins.join(" ") : "'none'";
}
