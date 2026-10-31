// Response shapes of /clients/v1/apps (apps/api developer-apps.service.ts). A secret only ever arrives from create or rotate.

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

/** The partner's server .env. Without the secret its line stays empty: it is only ever shown once. */
export function envBlock(clientId: string, secret?: string | null): string {
  return [
    ...Object.entries(TALLY_ENV).map(([k, v]) => `${k}=${v}`),
    `TALLY_CLIENT_ID=${clientId}`,
    secret ? `TALLY_CLIENT_SECRET=${secret}` : "# Shown once, when you create the app or rotate its secret.\nTALLY_CLIENT_SECRET=",
  ].join("\n");
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
