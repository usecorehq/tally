# Tally docs

Everything about how Tally is built and how to run it. Docs ship with the code: a PR that changes behaviour updates the doc and diagram that describe it (see [Keeping docs current](guides/documentation.md)).

## Architecture

Why we made the choices we made. Read these before changing something load-bearing.

- **[Auth](architecture/auth.md)** — Shared Qorelly Supabase Auth; NextAuth v5 on web, `supabase_flutter` on mobile, `SupabaseJwtGuard` on the API.
- **[Database](architecture/database.md)** — The `tally` schema inside the shared Qorelly database, Drizzle, and why our migration ledger is `tally.__drizzle_migrations`.
- **[Qore Catalog integration](architecture/catalog.md)** — The `x-api-key` client, where the key may and may not go.
- **[Mobile app](architecture/mobile.md)** — `qore_tally` clean architecture: layers, `Either<Failure, T>`, get_it, bloc vs cubit.
- **[Mobile flavors](architecture/mobile-flavors.md)** — `dev` / `staging` / `prod`: app IDs, per-environment `.env` files, how `--flavor` and `-t` resolve, gotchas.
- **[Onboarding](architecture/onboarding.md)** — Create a business from a Qore Catalog sub-type, turn its template into a starter inventory, send every decision back as feedback. Safe to retry.
- **[Barcode scan](architecture/barcode-scan.md)** — Scan to find an item in the merchant's inventory; link unknown barcodes once. One item per barcode, UPC-A = EAN-13.
- **[Q Vision distillation](architecture/qvision-distillation.md)** — *Planned.* Console → API → train service against Qore Catalog, plus the open questions.

### Diagrams

- **[Architecture diagrams](diagrams/README.md)** — C4 model, auth sequences, database isolation, migration flow, mobile layers and flavors, system flowchart and journeys.

## Guides

- **[Local development](guides/local-development.md)** — Setup, env, running every app.
- **[Database migrations](guides/database-migrations.md)** — Generate, review, apply on staging, hand to the CTO.
- **[Keeping docs current](guides/documentation.md)** — What to update when, and how to regenerate diagrams.

Deploy guides are not written yet — hosting targets for api, console, mp and train are still undecided.

## Contributing

- Branch from `staging`; PRs target `staging`. Never branch from or merge `origin/main`.
- Commit messages: conventional, lowercase (`feat(api): …`, `docs: …`), bulleted body for larger changes, no AI co-author.
- Money in reporting reads only paid amounts — never order totals.
- Feature configuration lives in DB columns, not env vars.
- Secrets never enter git: `pnpm install` turns on a pre-commit hook (`scripts/check-secrets.sh`) and CI runs the same check. Real values go in gitignored `.env` files, never in a `.env.example`. If a key is ever exposed, revoke it.
