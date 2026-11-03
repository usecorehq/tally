# Tally — agent notes

See README.md for layout. Hard rules for this repo:

- Database objects live in the `tally` schema only. Never create/alter anything in `public`, `auth`, or `bookmi` — those belong to other projects on the shared Supabase database.
- Migrations: edit `packages/db/src/schema.ts`, then `pnpm db:generate --name=<semantic_name>`. Never hand-edit or rename an applied migration. Staging only; production is applied by the CTO.
- Grants and tightenings never share a migration.
- Money: revenue/reporting reads only paid amounts (paid_amount, payments tables, amount_paid) — never order totals.
- Feature configuration lives in DB columns, not env vars.
- A pre-commit hook (`.githooks/pre-commit` → `scripts/check-secrets.sh`, installed by `pnpm install`) and the CI `secrets` job block Qore Catalog keys, Supabase secret keys, private keys and AWS keys. Never bypass it with `--no-verify` for a real value. Stage files by explicit path, not `git add -A`.
- Secrets (QORE_CATALOG_API_KEY, SUPABASE_JWT_SECRET, SUPABASE_DB_URL) are server-only. Never import them into client components or the Flutter app.
- Mobile (`apps/mobile`): clean architecture — data/domain/presentation per feature, repositories return `Either<Failure, T>`, DI via get_it in `injection_container.dart`, bloc for app-level flows and cubit for screen-local state.
- Mobile flavors (`dev`, `staging`, `prod`) are defined in three places that must agree: `android/app/build.gradle.kts` productFlavors, `FLAVORS` in `apps/mobile/tool/setup_ios_flavors.rb` (re-run it after changes), and `lib/main_<flavor>.dart`. Always run with a matching `--flavor` / `-t` pair. Mobile env lives in gitignored `apps/mobile/.env.<flavor>` — public values only.
- Web design: Qorelly Design V2 (design.qorelly.com) via `@tally/ui` — grey trays holding white sheets, 12px (`rounded-xl`) buttons, hairline sheet shadows and a real shadow only on dialogs, Phosphor icons through `SolarIcon` (Light; `iconStyle="Fill"` = active), colour only for meaning. Light and dark: sheets are `bg-surface` and hairlines `ring-hairline/[x]`, never `bg-white` / `ring-black` (they don't flip); `.dark` on <html>, set by the sidebar toggle. Every data surface has loading, failed (retry, "–" figures) and empty states. Preview every element at `/design` in mp (dev only).
- Docs ship with the code: follow docs/guides/documentation.md. New/changed flows, apps, env vars or commands update the matching doc and, where a diagram image (docs/diagrams/) becomes wrong, replace it or flag it in the PR. Diagrams are images; there is no Mermaid source. Mark unbuilt things as planned.
- Each app keeps its README.md and .env.example current.
- Commits: conventional, lowercase — `feat(api): ...`, `fix(mp): ...`, `chore: ...`. No Claude/AI co-author trailers.
- Comments: at most two lines, a concise summary of why. No usage instructions (READMEs have them) and no sample business or product names.
