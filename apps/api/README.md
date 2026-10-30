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
| `SUPABASE_DB_URL` | yes | Postgres URL for Drizzle (`tally` schema). Deployed: use the Supabase **transaction pooler, port 6543**. The session pooler (5432) has 15 client slots shared with the other Qorelly apps, and a full pool made stock-take runs hang. `pnpm db:migrate` may keep using 5432 |
| `DB_POOL_MAX` | no | Connections this process may hold. Default `5`; keep it small (shared pooler) |
| `QORE_CATALOG_API_KEY` | yes | Sent as `x-api-key`; server-only |
| `QORE_CATALOG_BASE_URL` | no | Default `http://localhost:3100` |
| `META_MODEL_API_KEY` | no | Meta Model API bearer key (Muse Spark); server-only. Unset → vision routes return 503 |
| `META_MODEL_BASE_URL` | no | Default `https://api.meta.ai/v1` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | no | Cloudflare R2 `tally-media` (token scoped to that bucket) for product crops under `tally/`; server-only. Unset → crops skipped |
| `PORT` | no | Default `4100` |
| `CORS_ORIGINS` | no | Comma-separated allowlist |

## Postman

`postman/tally-api.postman_collection.json`: 21 requests (auth, health, catalog, businesses & inventory, vision).

- Import it, then set `baseUrl` (local `http://localhost:4100`, staging `https://tally-api.qorecatalogue.com`), `supabaseUrl` (Supabase project URL), `supabaseAnonKey`, and a **test account's** `email` / `password` as secret variables in your own Postman. Never commit or share real credentials.
- Run **Auth → Sign in** first. It stores a Supabase access token used as `Authorization: Bearer`; tokens expire after about an hour.
- Requests save the ids they create (`businessId`, `itemId`, `scanId`, `runId`, the identify reading) for the next steps. Photo requests take a file in the `image` field.

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

## Vision benchmark

`scripts/vision-benchmark.mjs` scores the quick shelf scan against the stock-take agent on photos with hand-counted ground truth. It runs the built code (no database, empty inventory) and spends Meta Model API credit (about $0.02 per photo for the quick scan, $0.05–0.15 for the agent).

```bash
pnpm --filter @tally/api build
# 1. A starter truth file from the quick scan, written next to the photo as shelf1.truth.json
node --env-file=apps/api/.env apps/api/scripts/vision-benchmark.mjs --template ~/shelves/shelf1.jpg
# 2. Correct it by hand: brand/name/pack as printed, every unit counted, the right Qore ID (or null)
# 3. Benchmark a folder (or a list of photos); photos without a truth file are skipped
node --env-file=apps/api/.env apps/api/scripts/vision-benchmark.mjs ~/shelves --out ~/shelves/results.json
# 4. Or compare the single read with the experimental shelf sweep (no agent run)
node --env-file=apps/api/.env apps/api/scripts/vision-benchmark.mjs ~/shelves --sweep --out ~/shelves/sweep.json
```

Truth file (`shelf1.truth.json` or `shelf1.jpg.truth.json`):

```json
{ "products": [{ "brand": "Peak", "name": "Full Cream Milk Powder", "pack": "400g", "count": 12, "qid": "QC-…" }] }
```

- **Runs:** per photo, the quick scan, then the agent starting from that same first pass with the same tools and deps as `VisionService.runStocktake`. The agent's time, tokens and cost include the first pass. If the agent throws, it is scored on the quick-scan fallback and marked `fallback`.
- **Matching** (`src/modules/vision/benchmark-score.ts`): each detection pairs with at most one truth product by word overlap of normalised brand + name (≥ 0.5; brands, when both are read, must share a word). Extra lines for an already-paired product count against precision.
- **Scores:** product recall and precision; brand read right (case and spaces ignored); name read right (same words, any order); Qore ID right / wrong / missing (only where the truth has one); count mean absolute error and share within ±20%; time; tokens; estimated $ (Muse Spark Standard $1.25/M in, $4.25/M out; SAM $2.50 per 1,000 images; catalogue calls not priced).
- **Shelf sweep (`--sweep`, experimental):** compares the single read with the [shelf sweep](../../docs/architecture/vision-recognition.md#shelf-sweep-experimental) instead of running the agent. Both feed the same SAM count and catalogue match. Add `--grid` to skip the layout call and use the fixed 3 × 2 grid. The sweep's time, tokens and $ include its layout and every cell call (`Spark calls` column), and each photo lists every cell's coverage (read / empty / unreadable). Expect several times the quick scan's tokens. Use full-resolution phone photos: on small photos (under ~1500 px) the cells have little extra detail to offer.
- **Variance:** The read varies a lot run to run, so run each photo more than once when benchmarking.
- **Output:** Markdown tables (per photo, totals, per product) on stdout; full JSON (detections, pairs, agent steps) to `--out`, default the OS temp dir. `--out` inside the repo is refused. Keep photos, truth files and results out of the repo.

## Vision review

To see why a scan or stock-take came out the way it did, `scripts/vision-review.mjs` prints each line from the database: what was read, the catalogue candidates with their names, the agent's verdict (recorded, unresolved and why) and the merchant's decision (`accepted` = kept the top pick). Read-only; prints merchant data to the terminal only.

```bash
pnpm turbo run build --filter=@tally/db --filter=@tally/catalog-client
node --env-file=apps/api/.env apps/api/scripts/vision-review.mjs <runId or scanId>
node --env-file=apps/api/.env apps/api/scripts/vision-review.mjs --business "Superbox"   # its latest run
```

## Connect Tally clients

Partner apps that use Connect Tally are registered by the CTO with `scripts/oauth-client-create.mjs`. It writes a `tally.oauth_clients` row and prints the `client_id` and `client_secret` once. Only the secret's sha256 and its first 8 characters after `tcs_` are stored, so a lost secret means a new client. Clients are suspended, never deleted.

```bash
pnpm --filter @tally/db build
node --env-file=apps/api/.env apps/api/scripts/oauth-client-create.mjs --name "Partner App" \
  --redirect-uri https://partner.example/callback --origin https://partner.example
node --env-file=apps/api/.env apps/api/scripts/oauth-client-create.mjs --suspend <client_id>
```

- `--redirect-uri` (1–10, https, no `#fragment`) and `--origin` (https origins with no path; the iframe's `frame-ancestors`) can be repeated.
- `--scope` can be repeated: `stocktake:write`, `stocktake:read`, `inventory:read`. Default: all three.
- `--cap` (daily stock-takes, default 200) and `--concurrent` (runs at once, default 3) are abuse caps per client. When left out, the database defaults apply.

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
  modules/vision/benchmark-score.ts  Scoring for scripts/vision-benchmark.mjs (not used by routes)
  modules/vision/shelf-sweep.ts      Experimental row-by-row shelf read (benchmark only, not used by routes)
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
