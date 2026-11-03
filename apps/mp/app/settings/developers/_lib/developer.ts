// Response shapes of /clients/v1/apps (apps/api developer-apps.service.ts). A secret only ever arrives from create or rotate,
// and only mp's server sees it: the page gets HeldSecret and copies through a server action.

export type DeveloperApp = {
  client_id: string;
  name: string;
  logo_url: string | null;
  status: "active" | "suspended" | string;
  redirect_uris: string[];
  allowed_origins: string[];
  scopes: string[];
  secret_prefix: string;
  daily_stocktake_cap: number;
  max_concurrent_runs: number;
  created_at: string;
  updated_at: string;
};

export type WithSecret = DeveloperApp & { client_secret: string };

/** A just-issued secret mp's server holds for copying: what the page may know about it. */
export type HeldSecret = { last4: string; expiresAt: string };

/** create and rotate as the page sees them: the app, and the secret only as held. */
export type Issued = { app: DeveloperApp; held: HeldSecret };

/** GET /clients/v1/apps/:clientId/activity. `today.used` counts stock-takes and quick scans, as the daily cap does. */
export type AppActivity = {
  client_id: string;
  active_grants: number;
  today: { used: number; running: number };
  month: { stocktakes: number; scans: number };
  caps: { daily_stocktake_cap: number; max_concurrent_runs: number };
};

export type AppResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** The scopes a partner can ask for, in the consent screen's words (contracts §3). */
export const SCOPES = [
  { scope: "stocktake:write", label: "Run stock-takes", description: "Run stock-takes and update the merchant's stock. Needed for the embed." },
  { scope: "stocktake:read", label: "Read stock-takes", description: "See stock-take history and results." },
  { scope: "inventory:read", label: "Read inventory", description: "See the merchant's inventory." },
] as const;

// Production hosts, the same for every app; the partner fills in the id and secret.
export const TALLY_ENV = {
  TALLY_API_URL: "https://tally-api.qorecatalogue.com/api",
  TALLY_AUTHORIZE_URL: "https://tally.qorelly.com/oauth/authorize",
  TALLY_EMBED_ORIGIN: "https://embed.tally.qorelly.com",
} as const;

export const PARTNER_DEMO_URL = "https://github.com/usecorehq/tally/tree/main/examples/partner-demo#readme";

export const MASK = "••••••••";

/** How the secret is shown: the last 4 while held, otherwise the stored prefix. Never the secret. */
export const maskedSecret = (app: Pick<DeveloperApp, "secret_prefix">, held: HeldSecret | null) =>
  held ? `tcs_${MASK}${held.last4}` : `tcs_${app.secret_prefix}${MASK}`;

/** The partner's server .env. `secret` is only passed while copying; on screen the line is masked. */
export function envBlock(clientId: string, secretLine: string): string {
  return [...Object.entries(TALLY_ENV).map(([k, v]) => `${k}=${v}`), `TALLY_CLIENT_ID=${clientId}`, `TALLY_CLIENT_SECRET=${secretLine}`].join("\n");
}

export function quickstart(clientId: string): string {
  return `<div id="stocktake"></div>
<script src="/vendor/tally-embed.min.js"></script>
<script>
  TallyEmbed.mount({
    container: "#stocktake",
    clientId: "${clientId}",
    // Your own route: it calls POST /clients/v1/sessions with the access token.
    getSessionToken: () =>
      fetch("/api/session", { method: "POST" })
        .then((r) => r.json())
        .then((b) => b.sessionToken),
    onEvent: (e) => console.log(e.name, e.data),
  });
</script>`;
}
