# Database

> Diagrams: [tables (ERD)](../diagrams/images/tally-erd.svg) · [schema isolation](../diagrams/images/database-isolation.svg) · [migration flow](../diagrams/images/migration-flow.svg)

Tally stores its data in the **`tally` schema of the shared Qorelly Supabase Postgres**. Same database as Qorelly (`public`) and bookmi (`bookmi`), separate schema, separate migration ledger.

## Layout

| Thing | Where |
|---|---|
| Drizzle schema | `packages/db/src/schema.ts` — `export const tally = pgSchema("tally")` |
| Client | `packages/db/src/client.ts` — `buildTallyDb(url)` on `postgres.js`; `prepare: false` on the Supabase pooler; at most 5 connections, idle ones closed after 20 s, 15 s connect timeout. The API's `SUPABASE_DB_URL` should use the **transaction pooler, port 6543**: the session pooler (5432) has 15 client slots shared with other Qorelly projects, and idle sessions hold them. `pnpm db:migrate` can keep using 5432 |
| Migrations | `packages/db/migrations/`: `0000` schema, `0001` core tables, `0002` stock and payment functions (hand-written SQL, `drizzle-kit generate --custom`), `0003` unique barcode per business |
| Config | `packages/db/drizzle.config.ts`, reads `SUPABASE_DB_URL` from the root `.env`, falling back to `apps/api/.env` |
| API access | `DrizzleModule` provides the client as `TALLY_DB` |

## Tables

One store per business, Naira only, no VAT. Money is `numeric(12,2)`; Drizzle returns it as a string — never parse it to a float.

| Table | Holds |
|---|---|
| `businesses` | A merchant's shop: owner (`auth.users`), name, Qore Catalog vertical + sub-type, `sale_counter` |
| `business_members` | Who can use the shop: `owner` or `staff` |
| `inventory_items` | What the shop sells: optional `core_qid` link to Qore Catalog, name/variant/pack, price, cost, `quantity_on_hand`, `source` (template, photo, manual). Removing an item sets `archived_at`; rows are never deleted |
| `stock_movements` | Append-only log of every stock change: `opening`, `restock`, `sale`, `adjustment`, `void` |
| `sales` | One checkout: per-business `sale_number`, `completed` or `voided`, `subtotal − discount = total`, `paid_amount` |
| `sale_items` | Lines of a sale, with `item_name` and `unit_price` copied as sold |
| `sale_payments` | Money received for a sale: amount and method (`cash`, `transfer`, `card`, `other`); recorded, not processed |
| `vision_scans` | One shelf photo recognised by the camera flow: status (`open`, `confirmed`), image sha256 and size (the photo itself isn't in the database), models and timings |
| `vision_detections` | One product found in a scan: what Muse Spark read, Spark and SAM counts, boxes, catalogue candidates as Qore IDs + scores only, the item the merchant seems to stock, and the merchant's decision (`restock`, `restore`, `add`, `skip`) with its feedback outcome |
| `vision_agent_runs` | A stock-take agent run: status (`running`, `done`, `fallback`, `failed`), model, turns, tokens, error, the resulting scan |
| `vision_agent_steps` | The run's audit trail: one row per step (`baseline`, `thought`, `tool`) with tool, arguments and a short summary |
| `inventory_item_readings` | What the camera read for an item the merchant confirmed (`brand\|name\|pack`), so later scans recognise it; one reading → one item per business |

Child tables carry `business_id` and use composite foreign keys (`(business_id, x_id)`), so no row can point at another business's data.

### What the database enforces

| Rule | How |
|---|---|
| `sales.paid_amount` is the sum of its payments | Trigger on `sale_payments` recomputes it on every insert/update/delete; direct writes raise an error |
| `inventory_items.quantity_on_hand` moves only through `stock_movements` | Trigger on insert applies the delta under a row lock and sets `quantity_after`; direct writes raise an error; new items start at 0 (record an `opening` movement) |
| Stock history can't be rewritten | `stock_movements` rejects UPDATE and DELETE; corrections are new `adjustment` rows |
| A sale's stock is deducted once | `tally.deduct_sale_stock(sale_id, user_id)` is a no-op if `stock_deducted_at` is set |
| Voiding returns stock once | `tally.void_sale(sale_id, user_id, reason)`; raises if already voided |
| One item per barcode | Unique `(business_id, barcode)` among active items (`0003`); 12-digit UPC-A stored as 13-digit EAN |
| Retries don't duplicate | Optional `client_sale_id`, `client_payment_id`, `client_movement_id`, unique per business |
| Negative stock | Allowed (shops sell before they count), raised as a NOTICE |

### Recording a sale (one transaction in apps/api)

1. `select tally.next_sale_number(business_id)`
2. insert `sales` (with `subtotal`, `discount`, `total`; leave `paid_amount` alone) and its `sale_items`
3. insert `sale_payments`
4. `select tally.deduct_sale_stock(sale_id, user_id)`

### Money rule

Revenue and reports read `sale_payments` (or `sales.paid_amount`) for `completed` sales — never `total` or `subtotal`. A stored total is what the cashier charged; payments are what came in.

## Why the ledger is `tally.__drizzle_migrations`

Drizzle's default ledger is `drizzle.__drizzle_migrations`, and bookmi already uses it on this database. Drizzle's migrator only applies migrations newer than the latest row in its ledger, so sharing that table with bookmi would make Drizzle silently skip Tally migrations. `drizzle.config.ts` sets `migrations: { schema: "tally", table: "__drizzle_migrations" }`.

## Why `schemaFilter: ["tally"]`

`drizzle-kit` would otherwise diff (and offer to drop) every table in `public`, `auth` and `bookmi`. The filter keeps it blind to anything outside `tally`.

## Rules

- Objects live in `tally` only. Reference `auth.users(id)`; never write to `public` or `auth`.
- Applied migration files are frozen. Fix forward with a new migration.
- Grants and tightenings never share a migration.
- Staging only from this repo; production is applied by the CTO.
- Revenue and reporting read paid amounts (`sale_payments`, `sales.paid_amount`), never totals.
- Never write `sales.paid_amount` or `inventory_items.quantity_on_hand` from app code; the database rejects it.

## PostgREST

The apps read and write through `apps/api` + Drizzle, not PostgREST. If a client ever needs Supabase's REST API on `tally`, the schema must be added to PostgREST's exposed schemas (self-hosted: `PGRST_DB_SCHEMAS`) and given table grants + RLS.
