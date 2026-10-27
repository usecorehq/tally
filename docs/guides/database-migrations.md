# Database migrations

> Diagram: [migration flow](../diagrams/images/migration-flow.svg)

1. Edit `packages/db/src/schema.ts`. Every table is declared on `tally` (`tally.table(...)`).
2. Generate, always with a semantic name:
   ```bash
   pnpm db:generate --name=add_products
   ```
3. `pnpm db:check` — confirms `schema.ts` and the migrations agree (CI runs it too).
4. Read the SQL in `packages/db/migrations/`. Check: only `"tally".` objects; grants and tightenings in separate migrations; FKs to `auth.users` only by id.
5. Open a PR into `staging` with the migration and the doc update.
6. Apply to staging:
   ```bash
   pnpm db:migrate        # SUPABASE_DB_URL from the root .env, else apps/api/.env
   ```
7. From now on the file is frozen. Fix mistakes with a new migration.
8. Production is applied by the CTO.

`pnpm db:studio` opens drizzle-kit's inspector against the same URL.
