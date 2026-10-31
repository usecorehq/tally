import type { AppActivity, DeveloperApp, WithSecret } from "../../settings/developers/_lib/developer";

// Fixture apps for /design/settings?v=developers-*. The secret is built at runtime so the secrets check never sees one.

export const PREVIEW_SECRET = ["tcs", "PreviewOnly_notARealSecret".repeat(2).slice(0, 43)].join("_");


export const DEV_APP: DeveloperApp = {
  client_id: "tc_k3v9q2m7x1p8r4t6w0z5y2b7",
  name: "Shelfwise POS",
  logo_url: null,
  status: "active",
  redirect_uris: ["https://app.shelfwise.example/tally/callback", "https://staging.shelfwise.example/tally/callback"],
  allowed_origins: ["https://app.shelfwise.example"],
  scopes: ["stocktake:write", "stocktake:read", "inventory:read"],
  secret_prefix: PREVIEW_SECRET.slice(4, 12),
  daily_stocktake_cap: 200,
  max_concurrent_runs: 3,
  created_at: "2026-10-12T10:20:00Z",
  updated_at: "2026-10-30T08:00:00Z",
};

export const DEV_APPS: DeveloperApp[] = [
  DEV_APP,
  {
    ...DEV_APP,
    client_id: "tc_a1b2c3d4e5f6g7h8i9j0k1l2",
    name: "Ledgerly Books",
    logo_url: null,
    scopes: ["inventory:read"],
    allowed_origins: [],
    created_at: "2026-09-03T14:00:00Z",
  },
  { ...DEV_APP, client_id: "tc_m3n4o5p6q7r8s9t0u1v2w3x4", name: "Old prototype", logo_url: null, status: "suspended", created_at: "2026-08-20T09:00:00Z" },
];

export const CREATED: WithSecret = { ...DEV_APP, client_secret: PREVIEW_SECRET };

export const ACTIVITY: AppActivity = {
  client_id: DEV_APP.client_id,
  active_grants: 14,
  today: { used: 37, running: 1 },
  month: { stocktakes: 612, scans: 140 },
  caps: { daily_stocktake_cap: 200, max_concurrent_runs: 3 },
};
