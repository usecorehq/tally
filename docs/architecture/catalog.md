# Qore Catalog integration

Tally reads product data from the **Qore Catalog API** (`QORE_CATALOG_BASE_URL`, local default `http://localhost:3100`). Every route under `/v1` sits behind Qore Catalog's global `ApiKeyGuard`, which reads the `x-api-key` header.

| Caller | How |
|---|---|
| apps/api | `CatalogModule` → `CatalogService.client` (`@tally/catalog-client`), key from validated config `catalog.apiKey` |
| mp, console | `catalogClient()` in **server components only**; reads `QORE_CATALOG_BASE_URL` / `QORE_CATALOG_API_KEY` |
| services/train | `catalog_client()` (httpx) with the same header |
| mobile | Never directly. Goes through apps/api. |

## The key is server-only

`QORE_CATALOG_API_KEY` must never reach a browser bundle or the Flutter app. Do not prefix it `NEXT_PUBLIC_`, do not pass it via `--dart-define`. Anything a client needs from the catalog is proxied by apps/api.

## Current surface

Only `GET /v1/health` is wrapped today (`CatalogClient.health()`); `GET /api/health` on the Tally API reports it. Add endpoints to `packages/catalog-client/src/index.ts` as features need them, typed from the catalog's Swagger.
