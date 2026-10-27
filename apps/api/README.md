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
| `PORT` | no | Default `4100` |
| `CORS_ORIGINS` | no | Comma-separated allowlist |

## Layout

```
src/
  main.ts                     bootstrap: /api prefix, CORS, validation pipe, Swagger
  app.module.ts               ConfigModule, DrizzleModule, CatalogModule, feature modules, global guard
  config/                     env.validation.ts (class-validator) → configuration.ts (nested config)
  common/guards/              SupabaseJwtGuard (HS256 + JWKS, aud=authenticated)
  common/decorators/          @Public(), @CurrentUser()
  drizzle/drizzle.module.ts   TALLY_DB provider from @tally/db
  modules/catalog/            CatalogService wrapping @tally/catalog-client
  modules/health/             GET /api/health
```

## Adding a module

1. `src/modules/<name>/` with `<name>.module.ts`, controller, service.
2. Inject the DB with `@Inject(TALLY_DB) private readonly db: TallyDb`; tables come from `@tally/db/schema`.
3. Register the module in `app.module.ts`.
4. Routes are protected by default; get the user with `@CurrentUser() user: AuthenticatedUser` (`user.sub` = `auth.users.id`).
5. Update [docs](../../docs/guides/documentation.md) in the same PR.

See [docs/architecture/auth.md](../../docs/architecture/auth.md) and [docs/architecture/database.md](../../docs/architecture/database.md).
