export type HealthResponse = { status: string; db: string };

// Qore Catalog's global ApiKeyGuard reads this header. Server-side only — the
// key must never reach a browser bundle.
const API_KEY_HEADER = "x-api-key";

export class CatalogClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  private async get<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (this.apiKey) headers.set(API_KEY_HEADER, this.apiKey);
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`Catalog ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  health() {
    return this.get<HealthResponse>("/v1/health", { cache: "no-store" });
  }
}

export function catalogClient(
  baseUrl = process.env.QORE_CATALOG_BASE_URL ?? "http://localhost:3100",
  apiKey = process.env.QORE_CATALOG_API_KEY,
) {
  return new CatalogClient(baseUrl, apiKey);
}
