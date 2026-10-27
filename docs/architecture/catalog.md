# Qore Catalog integration

Tally reads product data from the **Qore Catalog API** (`QORE_CATALOG_BASE_URL`, local default `http://localhost:3100`). Every route under `/v1` sits behind Qore Catalog's global `ApiKeyGuard`, which reads the `x-api-key` header.

| Caller | How |
|---|---|
| apps/api | `CatalogModule` → `CatalogService.client` (`@tally/catalog-client`), key from validated config `catalog.apiKey`. The only Tally app that holds the key. |
| mp | Never directly. Calls Tally's `/api/catalog/*` (below) with the user's Supabase token. |
| console | Still calls `catalogClient()` in server components (`QORE_CATALOG_*`); to be moved behind apps/api like mp. |
| services/train | `catalog_client()` (httpx) with the same header |
| mobile | Never directly. Goes through apps/api. |

## Data flow

```
browser → mp (Next.js) → Tally apps/api (holds QORE_CATALOG_API_KEY) → Qore Catalog
```

mp and mobile call these routes on Tally's API. Responses are the catalogue's v1 shapes unchanged (types from `@tally/catalog-client`).

| Route | Auth | Calls | Notes |
|---|---|---|---|
| `GET /api/catalog/verticals` | public | `businessTaxonomy()` | Business types + sub-types, needed before signup. Cached 10 min. |
| `GET /api/catalog/subtypes/:code/templates?suggestions=0-5` | Supabase JWT | `subtypeTemplates(code, suggestions)` | `code` matches `^[a-z0-9_]{2,60}$`; default 0 suggestions. Cached 10 min per (code, suggestions). |
| `GET /api/catalog/products?q=&brand=&category=&limit=&offset=` | Supabase JWT | `searchProducts(...)` | `q` 2-200 chars, `limit` 1-100 (default 20), `offset` 0-10000. Not cached. |
| `GET /api/catalog/products/:qid` | Supabase JWT | `getProduct(qid)` | `qid` must be a Qore ID; a merged product returns `{ qid, status: "merged", mergedInto }`. |

Errors from the catalogue are mapped in one place (`apps/api/src/modules/catalog/catalog-errors.ts`):

| Catalogue | Tally returns |
|---|---|
| 400 | 400 with the catalogue's validation message |
| 404 | 404 (`No business sub-type <code>` / `No product with Qore ID <qid>`) |
| 401 / 403 | 502 `Catalogue access misconfigured`, logged as an error (Tally's key is wrong or revoked) |
| 429 | 503 with `Retry-After: 30` |
| timeout, network, 5xx | 502 `Catalogue unavailable` |

Responses and logs never contain the catalogue key, the upstream URL or the raw upstream body. The cache is in memory (one API instance) and has no invalidation.

## The key is server-only

`QORE_CATALOG_API_KEY` must never reach a browser bundle or the Flutter app. Do not prefix it `NEXT_PUBLIC_`, do not pass it via `--dart-define`. Anything a client needs from the catalog is proxied by apps/api.

## Current surface

`@tally/catalog-client` wraps the whole Qore Catalog v1 API. Types live in `packages/catalog-client/src/types.ts`; every method takes an optional trailing `RequestInit` (e.g. Next's `cache`).

| Method | Route | Notes |
|---|---|---|
| `health()` | `GET /v1/health` | No key sent. `GET /api/health` on the Tally API reports it. |
| `searchProducts({ q, brand, category, limit, offset })` | `GET /v1/products` | limit 1-100, default 20 |
| `getProduct(qid)` | `GET /v1/products/:qid` | Detail with indicative price + variants, or `{ status: "merged", mergedInto }`. qid format checked client-side. |
| `match({ items, limit })` | `POST /v1/match` | 1-50 items (checked client-side), limit 1-10. Results in request order; empty `candidates` = unidentified. |
| `businessTaxonomy()` | `GET /v1/business-taxonomy` | Verticals and their subtypes |
| `subtypeTemplates(code, suggestions?)` | `GET /v1/business-taxonomy/subtypes/:code/templates` | suggestions 0-5; first call with suggestions can take ~4s (20s timeout) |
| `brands({ q, limit, offset })` | `GET /v1/brands` | |
| `categories()` | `GET /v1/categories` | |
| `sendFeedback(items)` | `POST /v1/feedback` | Scope `feedback:write`, 1-100 items (checked client-side), idempotent per `clientRef` |
| `feedbackStats(since?)` | `GET /v1/feedback/stats` | |
| `whoAmI()` | `GET /v1/keys/me` | Key name, prefix, scopes, expiry |

Prices are indicative, whole Naira (`currency: "NGN"`). Requests time out after 10s (20s for templates with suggestions). Non-2xx responses and client-side guard failures throw `CatalogError` (`status`, `path`, `body`); the key never appears in error messages. 429 means the 120 requests/min per-key limit was hit.

Only `health()` is called by an app today; wiring the rest into the photo pipeline and onboarding is planned.

Tests: `pnpm --filter @tally/catalog-client test` (vitest, mocked fetch). Live check against a deployed catalog: build the package, then `pnpm --filter @tally/catalog-client smoke` with `QORE_CATALOG_BASE_URL` and `QORE_CATALOG_API_KEY` set.
