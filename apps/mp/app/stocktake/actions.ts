"use server";

import { api, ApiError } from "@/lib/api";
import type {
  ActionResult,
  CatalogProduct,
  CatalogProductDetail,
  ConfirmResult,
  Decision,
  HistoryEntry,
  ScanView,
  ShelfScanResult,
  StocktakeRun,
} from "./types";

const vision = (businessId: string) => `/businesses/${encodeURIComponent(businessId)}/vision`;

/** Vision-specific messages; lib/api's errorMessage reads 503 as the catalogue being busy. */
function fail(err: unknown): { ok: false; status: number; error: string } {
  if (err instanceof ApiError) {
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
  return { ok: false, status: 500, error: "Something went wrong on our side. Try again." };
}

/** Start the stock-take agent (202 { runId }); poll with pollStocktake. */
export async function startStocktake(businessId: string, form: FormData): Promise<ActionResult<{ runId: string }>> {
  try {
    const data = await api<{ runId: string }>(`${vision(businessId)}/stocktakes`, { method: "POST", body: form, timeoutMs: 30_000 });
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function pollStocktake(businessId: string, runId: string): Promise<ActionResult<StocktakeRun>> {
  try {
    const data = await api<StocktakeRun>(`${vision(businessId)}/stocktakes/${encodeURIComponent(runId)}`);
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

/** A stored scan, reopened (candidate names and prices fetched again). */
export async function getScan(businessId: string, scanId: string): Promise<ActionResult<ScanView>> {
  try {
    const data = await api<ScanView>(`${vision(businessId)}/shelf-scans/${encodeURIComponent(scanId)}`, { timeoutMs: 30_000 });
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

/** The business's stock-takes and quick scans, newest first. */
export async function stocktakeHistory(businessId: string, limit = 50): Promise<ActionResult<HistoryEntry[]>> {
  try {
    const data = await api<HistoryEntry[]>(`${vision(businessId)}/stocktakes?limit=${limit}`);
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

/** Rerun a stored stock-take on its kept photo (202 { runId }); the new run joins the photo's group. */
export async function rerunScan(businessId: string, scanId: string): Promise<ActionResult<{ runId: string }>> {
  try {
    const data = await api<{ runId: string }>(`${vision(businessId)}/shelf-scans/${encodeURIComponent(scanId)}/rerun`, { method: "POST" });
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

/** Drop an open stock-take: read-only, kept for audit. */
export async function discardScan(businessId: string, scanId: string): Promise<ActionResult<{ status: "discarded" }>> {
  try {
    const data = await api<{ status: "discarded" }>(`${vision(businessId)}/shelf-scans/${encodeURIComponent(scanId)}/discard`, { method: "POST" });
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

/** The sidebar's recents: the business in ?business= (else the user's first) and its newest stock-takes. */
export async function recentStocktakes(business: string | null): Promise<ActionResult<{ businessId: string; entries: HistoryEntry[] }>> {
  try {
    const businesses = await api<{ id: string }[]>("/businesses");
    const businessId = businesses.find((b) => b.id === business)?.id ?? businesses[0]?.id;
    if (!businessId) return { ok: true, data: { businessId: "", entries: [] } };
    const entries = await api<HistoryEntry[]>(`${vision(businessId)}/stocktakes?limit=30`);
    return { ok: true, data: { businessId, entries } };
  } catch (err) {
    return fail(err);
  }
}

/** The quick scan: one synchronous request, ~15–30 s (the API gives up at 45 s). */
export async function quickScan(businessId: string, form: FormData): Promise<ActionResult<ShelfScanResult>> {
  try {
    const data = await api<ShelfScanResult>(`${vision(businessId)}/shelf-scans`, { method: "POST", body: form, timeoutMs: 60_000 });
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function confirmScan(
  businessId: string,
  scanId: string,
  decisions: Decision[],
): Promise<ActionResult<ConfirmResult>> {
  try {
    const data = await api<ConfirmResult>(`${vision(businessId)}/shelf-scans/${encodeURIComponent(scanId)}/confirm`, {
      method: "POST",
      json: { decisions },
      timeoutMs: 60_000,
    });
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

/** Catalogue search for the product picker (signed-in route; the catalogue key stays in apps/api). */
export async function searchCatalogue(q: string): Promise<ActionResult<CatalogProduct[]>> {
  try {
    const data = await api<{ items: CatalogProduct[] }>(`/catalog/products?q=${encodeURIComponent(q)}&limit=10`);
    return { ok: true, data: data.items };
  } catch (err) {
    return fail(err);
  }
}

/** One catalogue product with its price and its other sizes; a merged product is followed once. */
export async function catalogueProduct(qid: string): Promise<ActionResult<CatalogProductDetail>> {
  try {
    let data = await api<CatalogProductDetail | { qid: string; status: "merged"; mergedInto: string }>(`/catalog/products/${encodeURIComponent(qid)}`);
    // Every product has a status ("active", …); only a merged one has mergedInto.
    if ("mergedInto" in data) data = await api<CatalogProductDetail>(`/catalog/products/${encodeURIComponent(data.mergedInto)}`);
    return { ok: true, data: data as CatalogProductDetail };
  } catch (err) {
    return fail(err);
  }
}
