# Tally docs

Everything about how Tally is built and how to run it. Docs ship with the code: a PR that changes behaviour updates the doc and diagram that describe it (see [Keeping docs current](guides/documentation.md)).

## Architecture

Why we made the choices we made. Read these before changing something load-bearing.

- **[Auth](architecture/auth.md)** — Shared Qorelly Supabase Auth; NextAuth v5 on web, `supabase_flutter` on mobile, `SupabaseJwtGuard` on the API.
- **[Database](architecture/database.md)** — The `tally` schema inside the shared Qorelly database, Drizzle, and why our migration ledger is `tally.__drizzle_migrations`.
- **[Qore Catalog integration](architecture/catalog.md)** — The `x-api-key` client, where the key may and may not go.
- **[Mobile app](architecture/mobile.md)** — `qore_tally` clean architecture: layers, `Either<Failure, T>`, get_it, bloc vs cubit.
- **[Q Vision distillation](architecture/qvision-distillation.md)** — *Planned.* Console → API → train service against Qore Catalog, plus the open questions.

### Diagrams

- **[Architecture diagrams](diagrams/README.md)** — C4 model, auth sequences, database isolation, migration flow, mobile layers, system flowchart and journeys.

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
