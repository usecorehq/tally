import type { Grant, Plan, SettingsBusiness, Usage } from "../../settings/_lib/types";

// Fixture data for /design/settings. Prices are kobo and display-only.

export const BUSINESSES: SettingsBusiness[] = [
  { id: "b1", name: "Mama Nkechi Provisions", role: "owner" },
  { id: "b2", name: "Lekki Mini Mart", role: "staff" },
];

const LOGO =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="10" fill="#0F766E"/><path d="M10 24V12h6a4 4 0 0 1 0 8h-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="23" r="3" fill="#fff"/></svg>',
  );

export const GRANTS: Grant[] = [
  {
    id: "g1",
    client: { client_id: "tc_0123456789abcdefghijklmn", name: "Shelfwise POS", logo_url: LOGO },
    business_id: "b1",
    scopes: ["stocktake:write", "stocktake:read", "inventory:read"],
    created_at: "2026-10-02T09:14:00Z",
    last_used_at: "2026-10-30T16:40:00Z",
  },
  {
    id: "g2",
    client: { client_id: "tc_zyxwvutsrqponmlkjihgfedc", name: "Ledgerly Books", logo_url: null },
    business_id: "b1",
    scopes: ["inventory:read"],
    created_at: "2026-10-21T12:00:00Z",
    last_used_at: null,
  },
];

const day = (i: number) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
const DAILY = Array.from({ length: 30 }, (_, i) => ({
  date: day(i),
  stocktakes: [2, 3, 1, 0, 4, 5, 2, 1, 3, 3, 0, 0, 2, 4, 5, 5, 3, 1, 2, 4, 3, 0, 1, 5, 4, 3, 2, 3, 4, 3][i]!,
  scans: [1, 0, 2, 0, 1, 3, 1, 0, 0, 2, 0, 1, 1, 2, 0, 3, 1, 1, 0, 2, 1, 0, 0, 1, 2, 1, 0, 2, 1, 1][i]!,
}));

export const FREE = { code: "free", name: "Free", daily_stocktake_limit: 5, max_concurrent_runs: 1, simulated: false };
export const PRO = { code: "pro", name: "Pro", daily_stocktake_limit: 100, max_concurrent_runs: 3, simulated: true };

export const USAGE: Usage = {
  plan: FREE,
  today: { stocktakes: 2, scans: 1 },
  month: { stocktakes: 79, scans: 31, input_tokens: 1_284_300, output_tokens: 96_420 },
  daily: DAILY,
  by_source: [
    { client_id: null, name: "Tally", stocktakes: 51 },
    { client_id: "tc_0123456789abcdefghijklmn", name: "Shelfwise POS", stocktakes: 28 },
  ],
};

export const USAGE_EMPTY: Usage = {
  ...USAGE,
  today: { stocktakes: 0, scans: 0 },
  month: { stocktakes: 0, scans: 0, input_tokens: 0, output_tokens: 0 },
  daily: DAILY.map((d) => ({ ...d, stocktakes: 0, scans: 0 })),
  by_source: [],
};

export const PLANS: Plan[] = [
  { code: "free", name: "Free", price_kobo_monthly: 0, daily_stocktake_limit: 5, max_concurrent_runs: 1 },
  { code: "pro", name: "Pro", price_kobo_monthly: 1_500_000, daily_stocktake_limit: 100, max_concurrent_runs: 3 },
];
