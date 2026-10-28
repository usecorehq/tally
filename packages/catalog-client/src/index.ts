import type {
  ApiKeyInfo,
  Brand,
  BrandSearchParams,
  BusinessVertical,
  Category,
  FeedbackItem,
  FeedbackResponse,
  FeedbackStats,
  HealthResponse,
  ImageView,
  MatchRequest,
  MatchResponse,
  MergedProduct,
  Page,
  ProductDetail,
  ProductSearchParams,
  ProductSearchResult,
  SubtypeTemplates,
  UploadImageResponse,
} from "./types";

export * from "./types";

// Qore Catalog's global ApiKeyGuard reads this header. Server-side only — the
// key must never reach a browser bundle.
const API_KEY_HEADER = "x-api-key";

const DEFAULT_TIMEOUT_MS = 10_000;
// Template suggestions run a match per item; the first uncached call takes ~4s.
const SUGGESTIONS_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const MAX_MATCH_ITEMS = 50;
const MAX_FEEDBACK_ITEMS = 100;

// Crockford base32 (no I, L, O, U).
export const QID_PATTERN = /^QC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]$/;

type Query = Record<string, string | number | undefined>;

type RequestOptions = {
  query?: Query;
  body?: unknown;
  init?: RequestInit;
  timeoutMs?: number;
  /** false for routes outside the ApiKeyGuard (health). */
  auth?: boolean;
};

/** Thrown on any non-2xx response, and by client-side guards (status 400) before a request is sent. */
export class CatalogError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    /** Parsed JSON error body when the response had one, else the raw text. */
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export class CatalogClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  private async request<T>(method: "GET" | "POST", path: string, opts: RequestOptions = {}): Promise<T> {
    const { query, body, init, timeoutMs = DEFAULT_TIMEOUT_MS, auth = true } = opts;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    const fullPath = qs ? `${path}?${qs}` : path;

    const headers = new Headers(init?.headers);
    if (auth && this.apiKey) headers.set(API_KEY_HEADER, this.apiKey);
    // FormData sets its own multipart content-type (with the boundary).
    const multipart = body instanceof FormData;
    if (body !== undefined && !multipart) headers.set("content-type", "application/json");

    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}${fullPath}`, {
      ...init,
      method,
      headers,
      signal,
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // not JSON; keep the text
      }
      const detail = (parsed as { message?: unknown } | null)?.message;
      const suffix = typeof detail === "string" ? ` ${detail}` : Array.isArray(detail) ? ` ${detail.join("; ")}` : "";
      throw new CatalogError(
        res.status,
        fullPath,
        parsed,
        this.redact(`Catalog ${method} ${fullPath} failed: ${res.status}${suffix}`),
      );
    }
    return res.json() as Promise<T>;
  }

  private redact(message: string) {
    return this.apiKey ? message.split(this.apiKey).join("[redacted]") : message;
  }

  /** No key needed. */
  health(init?: RequestInit) {
    return this.request<HealthResponse>("GET", "/v1/health", { init: { cache: "no-store", ...init }, auth: false });
  }

  searchProducts(params: ProductSearchParams = {}, init?: RequestInit) {
    return this.request<ProductSearchResult>("GET", "/v1/products", { query: params, init });
  }

  /** A merged qid returns a pointer to the surviving product instead of the detail. */
  async getProduct(qid: string, init?: RequestInit) {
    const path = `/v1/products/${encodeURIComponent(qid)}`;
    if (!QID_PATTERN.test(qid)) throw guardError(path, `invalid qid ${qid}`);
    return this.request<ProductDetail | MergedProduct>("GET", path, { init });
  }

  /** Results come back in request order; empty candidates means unidentified. */
  async match(request: MatchRequest, init?: RequestInit) {
    const n = request.items.length;
    if (n < 1 || n > MAX_MATCH_ITEMS) {
      throw guardError("/v1/match", `match takes 1-${MAX_MATCH_ITEMS} items, got ${n}`);
    }
    return this.request<MatchResponse>("POST", "/v1/match", { body: request, init });
  }

  businessTaxonomy(init?: RequestInit) {
    return this.request<BusinessVertical[]>("GET", "/v1/business-taxonomy", { init });
  }

  /** suggestions (0-5) adds match candidates to template items; cached server-side for an hour. */
  subtypeTemplates(code: string, suggestions?: number, init?: RequestInit) {
    const path = `/v1/business-taxonomy/subtypes/${encodeURIComponent(code)}/templates`;
    return this.request<SubtypeTemplates>("GET", path, {
      query: { suggestions },
      init,
      timeoutMs: suggestions ? SUGGESTIONS_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
    });
  }

  brands(params: BrandSearchParams = {}, init?: RequestInit) {
    return this.request<Page<Brand>>("GET", "/v1/brands", { query: params, init });
  }

  categories(init?: RequestInit) {
    return this.request<Category[]>("GET", "/v1/categories", { init });
  }

  /** Needs the feedback:write scope. Idempotent per clientRef, so retries are safe. */
  async sendFeedback(items: FeedbackItem[], init?: RequestInit) {
    const n = items.length;
    if (n < 1 || n > MAX_FEEDBACK_ITEMS) {
      throw guardError("/v1/feedback", `feedback takes 1-${MAX_FEEDBACK_ITEMS} items, got ${n}`);
    }
    return this.request<FeedbackResponse>("POST", "/v1/feedback", { body: { items }, init });
  }

  /**
   * POST /v1/images: a product picture for a confirmed Qore ID (scope
   * feedback:write). Send a tight crop, never the whole shelf. Send the
   * /v1/feedback line first and pass its clientRef as feedbackClientRef.
   * Stored once per sha256, so resending is safe. Pending until a curator approves it.
   */
  async uploadImage(
    upload: { file: Blob | Uint8Array; filename: string; qid: string; view?: ImageView; feedbackClientRef?: string },
    init?: RequestInit,
  ) {
    const size = upload.file instanceof Blob ? upload.file.size : upload.file.byteLength;
    if (size === 0 || size > MAX_IMAGE_BYTES) {
      throw guardError("/v1/images", `image must be 1 byte to 8 MB, got ${size}`);
    }
    if (!QID_PATTERN.test(upload.qid)) throw guardError("/v1/images", `invalid qid ${upload.qid}`);
    const form = new FormData();
    const blob = upload.file instanceof Blob ? upload.file : new Blob([upload.file as Uint8Array<ArrayBuffer>]);
    form.set("file", blob, upload.filename);
    form.set("qid", upload.qid);
    if (upload.view) form.set("view", upload.view);
    if (upload.feedbackClientRef) form.set("feedbackClientRef", upload.feedbackClientRef);
    return this.request<UploadImageResponse>("POST", "/v1/images", { body: form, init, timeoutMs: UPLOAD_TIMEOUT_MS });
  }

  /** since: ISO date. */
  feedbackStats(since?: string, init?: RequestInit) {
    return this.request<FeedbackStats>("GET", "/v1/feedback/stats", { query: { since }, init });
  }

  whoAmI(init?: RequestInit) {
    return this.request<ApiKeyInfo>("GET", "/v1/keys/me", { init });
  }
}

function guardError(path: string, message: string) {
  return new CatalogError(400, path, { statusCode: 400, path, message }, `Catalog ${path} rejected: ${message}`);
}

export function catalogClient(
  baseUrl = process.env.QORE_CATALOG_BASE_URL ?? "http://localhost:3100",
  apiKey = process.env.QORE_CATALOG_API_KEY,
) {
  return new CatalogClient(baseUrl, apiKey);
}
