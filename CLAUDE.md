# Tally — agent notes

See README.md for layout. Hard rules for this repo:

- Database objects live in the `tally` schema only. Never create/alter anything in `public`, `auth`, or `bookmi` — those belong to other projects on the shared Supabase database.
- Migrations: edit `packages/db/src/schema.ts`, then `pnpm db:generate --name=<semantic_name>`. Never hand-edit or rename an applied migration. Staging only; production is applied by the CTO.
- Grants and tightenings never share a migration.
- Money: revenue/reporting reads only paid amounts (paid_amount, payments tables, amount_paid) — never order totals.
- Feature configuration lives in DB columns, not env vars.
- Secrets (QORE_CATALOG_API_KEY, SUPABASE_JWT_SECRET, SUPABASE_DB_URL) are server-only. Never import them into client components or the Flutter app.
- Mobile (`apps/mobile`): clean architecture — data/domain/presentation per feature, repositories return `Either<Failure, T>`, DI via get_it in `injection_container.dart`, bloc for app-level flows and cubit for screen-local state.
- Web design: rounded-full buttons, no box shadows, Solar icons (Bold active / Outline inactive).
- Commits: conventional, lowercase — `feat(api): ...`, `fix(mp): ...`, `chore: ...`. No Claude/AI co-author trailers.
