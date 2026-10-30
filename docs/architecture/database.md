# Database

> Diagrams: [tables (ERD)](../diagrams/images/tally-erd.svg) · [vision tables](vision-schema.md) · [migration flow](../diagrams/images/migration-flow.svg)

Tally stores its data in the **`tally` schema of the shared Qorelly Supabase Postgres**. Same database as Qorelly (`public`) and bookmi (`bookmi`), separate schema, separate migration ledger.

## Layout

| Thing | Where |
|---|---|
| Drizzle schema | `packages/db/src/schema.ts` — `export const tally = pgSchema("tally")` |
| Client | `packages/db/src/client.ts` — `buildTallyDb(url, { max?, connectTimeout? })` on `postgres.js`; `prepare: false` on the Supabase pooler; at most 5 connections (`DB_POOL_MAX`), idle ones closed after 20 s, 10 s connect timeout. See [Connection pooling](#connection-pooling) |
| Migrations | `packages/db/migrations/`: `0000` schema, `0001` core tables, `0002` stock and payment functions (hand-written SQL, `drizzle-kit generate --custom`), `0003` unique barcode per business, `0010` OAuth clients, `0011` their `auth.users` keys (custom SQL, `drizzle-kit generate --custom`), `0012` plans and subscriptions, `0013` the placeholder plans (custom SQL) |
| Config | `packages/db/drizzle.config.ts`, reads `SUPABASE_DB_URL` from the root `.env`, falling back to `apps/api/.env` |
| API access | `DrizzleModule` provides the client as `TALLY_DB` |

## Tables

One store per business, Naira only, no VAT. Money is `numeric(12,2)`; Drizzle returns it as a string — never parse it to a float.

| Table | Holds |
|---|---|
| `businesses` | A merchant's shop: owner (`auth.users`), name, Qore Catalog vertical + sub-type |
| `business_members` | Who can use the shop: `owner` or `staff` |
| `inventory_items` | What the shop stocks: optional `core_qid` link to Qore Catalog, name/variant/pack, price, cost, `quantity_on_hand`, `source` (template, photo, manual). Removing an item sets `archived_at`; rows are never deleted |
| `stock_movements` | Append-only log of every stock change: `opening`, `restock`, `adjustment` (the `sale` and `void` types are unused) |
| `vision_scans` | One shelf photo recognised by the camera flow: status (`open`, `confirmed`), image sha256 and size (the photo itself is in R2 at `tally/scans/<scanId>.jpg`, not in the database), models and timings |
| `vision_detections` | One product found in a scan: what Muse Spark read, Spark and SAM counts, boxes, catalogue candidates as Qore IDs + scores only, the item the merchant seems to stock, and the merchant's decision (`restock`, `restore`, `add`, `skip`) with its feedback outcome |
| `vision_agent_runs` | A stock-take agent run: status (`running`, `done`, `fallback`, `failed`), model, turns, tokens, error, the resulting scan |
| `vision_agent_steps` | The run's audit trail: one row per step (`baseline`, `thought`, `tool`) with tool, arguments and a short summary |
| `inventory_item_readings` | What the camera read for an item the merchant confirmed (`brand\|name\|pack`), so later scans recognise it; one reading → one item per business |
| `oauth_clients` | A partner app registered for [Connect Tally](#oauth-clients-connect-tally): `client_id`, secret hash, redirect URIs, iframe origins, scopes, status, per-client caps |
| `oauth_codes` | A single-use authorization code (PKCE `S256`), valid for 60 s |
| `oauth_grants` | A merchant's consent for one client on one business, with its rotating refresh token hash |
| `plans` | A [plan](#plans-and-subscriptions)'s stock-take limits and display price: `free` or `pro` |
| `business_subscriptions` | A business's current plan (simulated); no row means `free` |

`sales`, `sale_items`, `sale_payments` and their functions came with the initial schema and are unused; Tally doesn't record sales. Removing them needs a migration (planned decision).

Child tables carry `business_id` and use composite foreign keys (`(business_id, x_id)`), so no row can point at another business's data.

### What the database enforces

| Rule | How |
|---|---|
| `inventory_items.quantity_on_hand` moves only through `stock_movements` | Trigger on insert applies the delta under a row lock and sets `quantity_after`; direct writes raise an error; new items start at 0 (record an `opening` movement) |
| Stock history can't be rewritten | `stock_movements` rejects UPDATE and DELETE; corrections are new `adjustment` rows |
| One item per barcode | Unique `(business_id, barcode)` among active items (`0003`); 12-digit UPC-A stored as 13-digit EAN |
| Retries don't duplicate | Optional `client_movement_id`, unique per business |
| Negative stock | Allowed (real stock can run ahead of the last count), raised as a NOTICE |

## OAuth clients (Connect Tally)

Partner apps ("clients") act on one business after its merchant consents, through an OAuth 2.0 authorization-code + PKCE flow. The OAuth endpoints that use them are in `apps/api/src/modules/clients/` (see [Auth](auth.md#connect-tally)).

| Table | Notes |
|---|---|
| `oauth_clients` | Registered by the CTO with `apps/api/scripts/oauth-client-create.mjs` ([usage](../../apps/api/README.md#connect-tally-clients)). `client_id` is `tc_` + 24 `[a-z0-9]`. `allowed_scopes` ⊆ `stocktake:write`, `stocktake:read`, `inventory:read`. `allowed_origins` is the embedded stock-take's `frame-ancestors`. `daily_stocktake_cap` (default 200) and `max_concurrent_runs` (default 3) are abuse caps per client, separate from the merchant's plan. `status` is `active` or `suspended`; clients are never deleted |
| `oauth_codes` | One row per authorization code: client, user, business, scopes, `redirect_uri`, PKCE challenge (`S256` only), `expires_at`, `used_at`. Indexed on `expires_at` for cleanup |
| `oauth_grants` | One active grant per `(client_id, business_id)` (unique where `revoked_at is null`). Holds the current and the previous refresh token hash: presenting the previous one again is a replay, so the grant is revoked. `refresh_expires_at`, `last_used_at`, `revoked_at` |

`vision_scans.client_id` and `vision_agent_runs.client_id` record which app ran a scan or stock-take (null = Tally's own apps). They reference `oauth_clients` with `ON DELETE RESTRICT`, so history keeps its app.

- **Only hashes are stored.** Client secrets, authorization codes and refresh tokens are kept as sha256 hex (checked by the database); the plain value is shown once and never written. `secret_prefix` (8 characters after `tcs_`) identifies a key without revealing it. `tcs_` secrets are also blocked by the secrets check.
- **`user_id` → `auth.users` is custom SQL.** `oauth_codes.user_id` and `oauth_grants.user_id` reference `auth.users(id)` `ON DELETE CASCADE`. The key crosses schemas, which Drizzle can't declare with `schemaFilter: ["tally"]`, so `0011` adds it by hand, as `0002` does for `businesses` and `business_members`.
- Everything else cascades from `businesses` and `oauth_clients`.

## Plans and subscriptions

Every stock-take and quick scan counts against the business's plan, whichever app started it (Tally's own apps or a Connect Tally client). The limit checks and usage endpoints are built: see [usage limits](stocktake-agent.md#usage-limits). The plan page is planned.

| Table | Notes |
|---|---|
| `plans` | Keyed by `code` (`free` or `pro`): `name`, `price_kobo_monthly` (display only), `daily_stocktake_limit`, `max_concurrent_runs`, `sort`, `active`. Seeded by `0013` with placeholders: Free is ₦0, 5 stock-takes a day, 1 at a time; Pro is ₦15,000 a month, 100 a day, 3 at a time. Change them with a new migration or an admin update, never by editing `0013` |
| `business_subscriptions` | At most one row per business (`business_id` unique, cascades from `businesses`): `plan_code` (→ `plans.code`, `ON DELETE RESTRICT`), `status` (`active` or `cancelled`), `simulated`, `started_at`, `current_period_end` |

- **No row means Free.** A business without a `business_subscriptions` row is on the `free` plan.
- **Subscribing is simulated.** `simulated` defaults to true and no payment is taken.
- **Plan prices are never revenue.** Under the money rule, revenue and reporting read only paid amounts; nothing creates payments, invoices or revenue figures from `price_kobo_monthly`.

## Connection pooling

The Supabase project is shared: Qorelly's apps, Bookmi and Tally all go through its pooler. Its **session mode** (port 5432) gives each client connection a server connection until the client disconnects, with **15 slots for the whole project**. postgres.js' default `idle_timeout: 0` keeps every opened connection for the life of the process. So a few processes at `max: 10` fill the pool, and new connections fail with `EMAXCONNSESSION … pool_size: 15` or wait. On staging that left a stock-take run stuck in its first pass with no way to record failure.

Tally therefore:

- **Connects the API through the transaction pooler (port 6543).** A server connection is held only for the length of a transaction. The connection string is the same except for the port; `prepare: false` is already set for pooler hosts.
- **Keeps few connections and gives idle ones back:** `max: 5` (`DB_POOL_MAX`), `idle_timeout: 20`, `max_lifetime: 30 min`.
- **Fails fast:** `connect_timeout: 10`. Queued queries still fail one connect timeout per slot at a time, about `(queries / max) × 10 s`. So long-running work also has its own deadlines (see [Stock-take agent](stocktake-agent.md#running-it)).

`pnpm db:migrate` can keep using the session pooler: migrations are short, single-connection runs.

## Why the ledger is `tally.__drizzle_migrations`

Drizzle's default ledger is `drizzle.__drizzle_migrations`, and bookmi already uses it on this database. Drizzle's migrator only applies migrations newer than the latest row in its ledger, so sharing that table with bookmi would make Drizzle silently skip Tally migrations. `drizzle.config.ts` sets `migrations: { schema: "tally", table: "__drizzle_migrations" }`.

## Why `schemaFilter: ["tally"]`

`drizzle-kit` would otherwise diff (and offer to drop) every table in `public`, `auth` and `bookmi`. The filter keeps it blind to anything outside `tally`.

## Rules

- Objects live in `tally` only. Reference `auth.users(id)`; never write to `public` or `auth`.
- Applied migration files are frozen. Fix forward with a new migration.
- Grants and tightenings never share a migration.
- Staging only from this repo; production is applied by the CTO.
- Never write `inventory_items.quantity_on_hand` from app code; the database rejects it.

## PostgREST

The apps read and write through `apps/api` + Drizzle, not PostgREST. If a client ever needs Supabase's REST API on `tally`, the schema must be added to PostgREST's exposed schemas (self-hosted: `PGRST_DB_SCHEMAS`) and given table grants + RLS.
