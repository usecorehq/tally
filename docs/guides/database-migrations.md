# Database migrations

> Diagram: [migration flow](../diagrams/images/migration-flow.svg)

1. Edit `packages/db/src/schema.ts`. Every table is declared on `tally` (`tally.table(...)`).
2. Generate, always with a semantic name:
   ```bash
   pnpm db:generate --name=add_products
   ```
3. Read the SQL in `packages/db/migrations/`. Check: only `"tally".` objects; grants and tightenings in separate migrations; FKs to `auth.users` only by id.
4. Open a PR into `staging` with the migration and the doc update.
5. Apply to staging:
   ```bash
   pnpm db:migrate        # uses SUPABASE_DB_URL from the root .env
   ```
6. From now on the file is frozen. Fix mistakes with a new migration.
7. Production is applied by the CTO.

`pnpm db:studio` opens drizzle-kit's inspector against the same URL.
