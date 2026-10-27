# Qore Catalog integration

Tally reads product data from the **Qore Catalog API** (`QORE_CATALOG_BASE_URL`, local default `http://localhost:3100`). Every route under `/v1` sits behind Qore Catalog's global `ApiKeyGuard`, which reads the `x-api-key` header.

| Caller | How |
|---|---|
| apps/api | `CatalogModule` → `CatalogService.client` (`@tally/catalog-client`), key from validated config `catalog.apiKey` |
| mp | Never directly; calls Tally's `/api/catalog/*` |
| console | Never directly; calls Tally's `/api/catalog/*` |
| services/train | `catalog_client()` (httpx) with the same header |
| mobile | Never directly. Goes through apps/api. |

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
