# Database

> Diagrams: [schema isolation](../diagrams/images/database-isolation.svg) · [migration flow](../diagrams/images/migration-flow.svg)

Tally stores its data in the **`tally` schema of the shared Qorelly Supabase Postgres**. Same database as Qorelly (`public`) and bookmi (`bookmi`), separate schema, separate migration ledger.

## Layout

| Thing | Where |
|---|---|
| Drizzle schema | `packages/db/src/schema.ts` — `export const tally = pgSchema("tally")` |
| Client | `packages/db/src/client.ts` — `buildTallyDb(url)` on `postgres.js`; `prepare: false` on the Supabase pooler |
| Migrations | `packages/db/migrations/` (`0000_tally_setup.sql` creates the schema) |
| Config | `packages/db/drizzle.config.ts`, reads `SUPABASE_DB_URL` from the root `.env` |
| API access | `DrizzleModule` provides the client as `TALLY_DB` |

## Why the ledger is `tally.__drizzle_migrations`

Drizzle's default ledger is `drizzle.__drizzle_migrations`, and bookmi already uses it on this database. Drizzle's migrator only applies migrations newer than the latest row in its ledger, so sharing that table with bookmi would make Drizzle silently skip Tally migrations. `drizzle.config.ts` sets `migrations: { schema: "tally", table: "__drizzle_migrations" }`.

## Why `schemaFilter: ["tally"]`

`drizzle-kit` would otherwise diff (and offer to drop) every table in `public`, `auth` and `bookmi`. The filter keeps it blind to anything outside `tally`.

## Rules

- Objects live in `tally` only. Reference `auth.users(id)`; never write to `public` or `auth`.
- Applied migration files are frozen. Fix forward with a new migration.
- Grants and tightenings never share a migration.
- Staging only from this repo; production is applied by the CTO.
- Revenue and reporting read paid amounts (`paid_amount`, payment tables), never order totals.

## PostgREST

The apps read and write through `apps/api` + Drizzle, not PostgREST. If a client ever needs Supabase's REST API on `tally`, the schema must be added to PostgREST's exposed schemas (self-hosted: `PGRST_DB_SCHEMAS`) and given table grants + RLS.
