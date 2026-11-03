// Response shapes from contracts §6. Plan prices are display-only: never revenue.

export type SettingsBusiness = { id: string; name: string; role: string };

/** GET /clients/v1/grants?businessId */
export type Grant = {
  id: string;
  client: { client_id: string; name: string; logo_url: string | null };
  business_id: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
};

/** GET /businesses/:businessId/usage?days=30 */
export type Usage = {
  plan: { code: string; name: string; daily_stocktake_limit: number; max_concurrent_runs: number; simulated: boolean };
  today: { stocktakes: number; scans: number };
  month: { stocktakes: number; scans: number; input_tokens: number; output_tokens: number };
  daily: { date: string; stocktakes: number; scans: number }[];
  by_source: { client_id: string | null; name: string; stocktakes: number }[];
};

/** GET /plans */
export type Plan = { code: string; name: string; price_kobo_monthly: number; daily_stocktake_limit: number; max_concurrent_runs: number };

/** POST /businesses/:businessId/subscription */
export type Subscription = { plan_code: string; status: string; simulated: true; started_at: string; current_period_end: string };

export type ActionResult = { ok: true } | { ok: false; error: string };
