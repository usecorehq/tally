# @tally/api

NestJS 11 backend for Tally. REST JSON under `/api`, Swagger at `/docs`. Every route needs a Supabase user JWT (shared Qorelly auth) unless marked `@Public()`.

## Run

```bash
cp apps/api/.env.example apps/api/.env   # or fill the repo-root .env — both are read
pnpm --filter @tally/api dev             # http://localhost:4100/api
```

`pnpm dev` at the root builds `@tally/db` and `@tally/catalog-client` first; running the filter alone needs them built once (`pnpm build`).

| URL | What |
|---|---|
| `GET /api/health` | Public liveness + Qore Catalog status |
| `/docs` | Swagger — Authorize with a Supabase `access_token` |

## Env

Loaded from `apps/api/.env`, then the repo-root `.env` for any key not set. Validated at boot by `src/config/env.validation.ts` — the process exits listing every missing var.

| Var | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Qorelly project URL; also used for JWKS |
| `SUPABASE_JWT_SECRET` | yes | HS256 secret for verifying user tokens |
| `SUPABASE_DB_URL` | yes | Postgres URL for Drizzle (`tally` schema) |
| `QORE_CATALOG_API_KEY` | yes | Sent as `x-api-key`; server-only |
| `QORE_CATALOG_BASE_URL` | no | Default `http://localhost:3100` |
| `META_MODEL_API_KEY` | no | Meta Model API bearer key (Muse Spark); server-only. Unset → vision routes return 503 |
| `META_MODEL_BASE_URL` | no | Default `https://api.meta.ai/v1` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | no | Cloudflare R2 `tally-media` (token scoped to that bucket) for product crops under `tally/`; server-only. Unset → crops skipped |
| `PORT` | no | Default `4100` |
| `CORS_ORIGINS` | no | Comma-separated allowlist |

## Deploy (Coolify)

`apps/api/Dockerfile` builds a production image from the repo root (`docker build -f apps/api/Dockerfile -t tally-api .`). The image holds no secrets and no `.env`; all config comes from runtime env vars.

Coolify app (staging):

| Setting | Value |
|---|---|
| Source | GitHub `usecorehq/tally`, branch `staging` |
| Build pack | Dockerfile, path `apps/api/Dockerfile`, base directory `/` |
| Ports exposes | `4100` |
| Port mappings | `127.0.0.1:4100:4100` |
| Health check | `/api/health` (also baked into the image) |

Runtime env vars (values live in Coolify only): `NODE_ENV=production`, `PORT=4100`, `CORS_ORIGINS` (Tally web origins; empty = none in production), `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_DB_URL`, `QORE_CATALOG_BASE_URL=https://api.qorecatalogue.com`, `QORE_CATALOG_API_KEY`, `META_MODEL_BASE_URL`, `META_MODEL_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=tally-media`. The four Supabase/Catalog key vars are required to boot (see [Env](#env)); the rest degrade features when unset.

- HTTPS is done by the server's nginx + certbot: the `tally-api.qorecatalogue.com` site forwards to `http://127.0.0.1:4100`. Coolify's proxy is not used.
- The container does not run migrations. After a schema PR merges, apply it to staging with `pnpm db:migrate`; production is applied by the CTO.

## Layout

```
src/
  main.ts                     bootstrap: /api prefix, CORS, validation pipe, Swagger
  app.module.ts               ConfigModule, DrizzleModule, CatalogModule, feature modules, global guard
  config/                     env.validation.ts (class-validator) → configuration.ts (nested config)
  common/guards/              SupabaseJwtGuard (HS256 + JWKS, aud=authenticated)
  common/decorators/          @Public(), @CurrentUser()
  drizzle/drizzle.module.ts   TALLY_DB provider from @tally/db
  modules/businesses/         businesses, membership, inventory, onboarding starter inventory
  modules/catalog/            CatalogService wrapping @tally/catalog-client
  modules/vision/             Camera recognition: shelf scan (Muse Spark, SAM 3.1, catalogue), confirm, identify, crops
  modules/vision/stocktake/   Stock-take agent: Muse Spark tool loop over a shelf photo (background runs + step trace)
  modules/media/              R2Storage: Tally's files in Cloudflare R2 (aws4fetch, server-only)
  modules/health/             GET /api/health
```

## Adding a module

1. `src/modules/<name>/` with `<name>.module.ts`, controller, service.
2. Inject the DB with `@Inject(TALLY_DB) private readonly db: TallyDb`; tables come from `schema` and query helpers (`eq`, `and`, `sql`, …) from `@tally/db`.
3. Register the module in `app.module.ts`.
4. Routes are protected by default; get the user with `@CurrentUser() user: AuthenticatedUser` (`user.sub` = `auth.users.id`).
5. Update [docs](../../docs/guides/documentation.md) in the same PR.

See [docs/architecture/auth.md](../../docs/architecture/auth.md) and [docs/architecture/database.md](../../docs/architecture/database.md).
