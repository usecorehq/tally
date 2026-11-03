import type { StocktakeApi } from "@/app/stocktake/api-context";
import type {
  ActionResult,
  CatalogProduct,
  CatalogProductDetail,
  ConfirmResult,
  PhotoCheck,
  PlanLimit,
  ScanView,
  ShelfScanResult,
  StocktakeRun,
} from "@/app/stocktake/types";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api").replace(/\/$/, "");

type Failure = { ok: false; status: number; error: string; limit?: PlanLimit };

export type EmbedAuth = {
  /** The session token, held in memory by the embed page. */
  token: () => string | null;
  /** Asks the host for a fresh token; null when none arrives. */
  refresh: () => Promise<string | null>;
  /** The grant was revoked or the token couldn't be renewed: nothing else will work. */
  onAuthError: (code: "grant_revoked" | "token_expired", message: string) => void;
};

/** Thrown inside request(); the public functions turn it into an ActionResult. */
class EmbedError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly limit?: PlanLimit,
  ) {
    super(message);
  }
}

const REVOKED = "This app's access to your Tally business was removed. Reconnect it to continue.";
const EXPIRED = "Your session with Tally ended. Reopen the stock-take to continue.";

/** The same messages as app/stocktake/actions.ts `fail()`, plus the embed-only auth, limit and network cases. */
function fail(err: unknown): Failure {
  if (err instanceof EmbedError) {
    if (err.limit) return { ok: false, status: 429, error: err.message, limit: err.limit };
    if (err.status === 401 && err.code === "grant_revoked") return { ok: false, status: 401, error: REVOKED };
    if (err.status === 401) return { ok: false, status: 401, error: EXPIRED };
    if (err.status === 503 && /not configured/i.test(err.message)) {
      return { ok: false, status: 503, error: "Photo recognition isn't set up on this server yet." };
    }
    if (err.status === 503) return { ok: false, status: 503, error: "Recognition is busy. Try again in a moment." };
    if (err.status === 413) return { ok: false, status: 413, error: "That photo is too large (4 MB max). Try a smaller one." };
    if (err.status === 504) return { ok: false, status: 504, error: "Recognition timed out. Try again, or a photo with fewer products." };
    if (err.status < 500) return { ok: false, status: err.status, error: err.message };
    return { ok: false, status: err.status, error: "Recognition failed on our side. Try again." };
  }
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return { ok: false, status: 504, error: "Recognition timed out. Try again, or a photo with fewer products." };
  }
  // fetch rejects with a TypeError when the network (or CORS) fails.
  if (err instanceof TypeError) return { ok: false, status: 0, error: "We couldn't reach Tally. Check your connection and try again." };
  return { ok: false, status: 500, error: "Something went wrong on our side. Try again." };
}

/** StocktakeApi over browser fetches with the embed session token, for the iframe. */
export function createEmbedApi(auth: EmbedAuth): StocktakeApi {
  async function send(path: string, init: { method?: string; body?: FormData; json?: unknown; timeoutMs?: number }, token: string | null) {
    return fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(init.json !== undefined && { "content-type": "application/json" }),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  }

  async function request<T>(path: string, init: { method?: string; body?: FormData; json?: unknown; timeoutMs?: number } = {}): Promise<T> {
    let res = await send(path, init, auth.token());
    let body = res.ok ? null : await errorBody(res);
    // An expired token: one fresh token from the host, one retry.
    if (res.status === 401 && body?.code === "token_expired") {
      const fresh = await auth.refresh();
      if (fresh) {
        res = await send(path, init, fresh);
        body = res.ok ? null : await errorBody(res);
      }
    }
    if (!res.ok) {
      const message = Array.isArray(body?.message) ? body.message.join("; ") : (body?.message ?? `Request failed (${res.status})`);
      if (res.status === 401) {
        const code = body?.code === "grant_revoked" ? "grant_revoked" : "token_expired";
        auth.onAuthError(code, code === "grant_revoked" ? REVOKED : EXPIRED);
        throw new EmbedError(401, message, code);
      }
      if (res.status === 429 && isLimitCode(body?.code)) {
        const retry = Number(body?.retry_after_seconds ?? res.headers.get("retry-after") ?? 0);
        throw new EmbedError(429, message, body.code, { code: body.code, retry_after_seconds: Number.isFinite(retry) ? retry : 0 });
      }
      throw new EmbedError(res.status, message, body?.code);
    }
    return res.json() as Promise<T>;
  }

  async function call<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
    try {
      return { ok: true, data: await fn() };
    } catch (err) {
      return fail(err);
    }
  }

  const vision = (businessId: string) => `/businesses/${encodeURIComponent(businessId)}/vision`;

  return {
    startStocktake: (businessId, form) =>
      call(() => request<{ runId: string }>(`${vision(businessId)}/stocktakes`, { method: "POST", body: form, timeoutMs: 30_000 })),
    pollStocktake: (businessId, runId) => call(() => request<StocktakeRun>(`${vision(businessId)}/stocktakes/${encodeURIComponent(runId)}`)),
    getScan: (businessId, scanId) =>
      call(() => request<ScanView>(`${vision(businessId)}/shelf-scans/${encodeURIComponent(scanId)}`, { timeoutMs: 30_000 })),
    rerunScan: (businessId, scanId) =>
      call(() => request<{ runId: string }>(`${vision(businessId)}/shelf-scans/${encodeURIComponent(scanId)}/rerun`, { method: "POST" })),
    discardScan: (businessId, scanId) =>
      call(() =>
        request<{ status: "discarded" }>(`${vision(businessId)}/shelf-scans/${encodeURIComponent(scanId)}/discard`, { method: "POST" }),
      ),
    checkPhoto: (businessId, form) =>
      call(() => request<PhotoCheck>(`${vision(businessId)}/photo-check`, { method: "POST", body: form, timeoutMs: 15_000 })),
    quickScan: (businessId, form) =>
      call(() => request<ShelfScanResult>(`${vision(businessId)}/shelf-scans`, { method: "POST", body: form, timeoutMs: 60_000 })),
    confirmScan: (businessId, scanId, decisions) =>
      call(() =>
        request<ConfirmResult>(`${vision(businessId)}/shelf-scans/${encodeURIComponent(scanId)}/confirm`, {
          method: "POST",
          json: { decisions },
          timeoutMs: 60_000,
        }),
      ),
    searchCatalogue: (q) =>
      call(async () => (await request<{ items: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(q)}&limit=10`)).items),
    catalogueProduct: (qid) =>
      call(async () => {
        let data = await request<CatalogProductDetail | { qid: string; status: "merged"; mergedInto: string }>(`/catalog/products/${encodeURIComponent(qid)}`);
        if ("mergedInto" in data) data = await request<CatalogProductDetail>(`/catalog/products/${encodeURIComponent(data.mergedInto)}`);
        return data as CatalogProductDetail;
      }),
  };
}

/** GET /businesses/:id for the header's business name (needs `inventory:read`); null on any failure. */
export async function embedBusinessName(businessId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/businesses/${encodeURIComponent(businessId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: unknown };
    return typeof body.name === "string" ? body.name : null;
  } catch {
    return null;
  }
}

type ErrorBody = { message?: string | string[]; code?: string; retry_after_seconds?: number } | null;

async function errorBody(res: Response): Promise<ErrorBody> {
  return (await res.json().catch(() => null)) as ErrorBody;
}

const isLimitCode = (code: unknown): code is PlanLimit["code"] => code === "plan_limit" || code === "client_cap" || code === "concurrent_runs";
