# Tally docs

Everything about how Tally is built and how to run it. Docs ship with the code: a PR that changes behaviour updates the doc and diagram that describe it (see [Keeping docs current](guides/documentation.md)).

## Product

- **[Photo-to-inventory PRD](prd-photo-to-inventory.md)** — *Planned.* The product side of [vision recognition](architecture/vision-recognition.md): users, screens, metrics, delivery slices, landing page.

## Architecture

Why we made the choices we made. Read these before changing something load-bearing.

- **[Auth](architecture/auth.md)** — Shared Qorelly Supabase Auth; NextAuth v5 on web, `supabase_flutter` on mobile, `SupabaseJwtGuard` on the API.
- **[Database](architecture/database.md)** — The `tally` schema inside the shared Qorelly database, Drizzle, and why our migration ledger is `tally.__drizzle_migrations`.
- **[Qore Catalog integration](architecture/catalog.md)** — The `x-api-key` client, where the key may and may not go.
- **[Mobile app](architecture/mobile.md)** — `qore_tally` clean architecture: layers, `Either<Failure, T>`, get_it, bloc vs cubit.
- **[Mobile flavors](architecture/mobile-flavors.md)** — `dev` / `staging` / `prod`: app IDs, per-environment `.env` files, how `--flavor` and `-t` resolve, gotchas.
- **[Onboarding](architecture/onboarding.md)** — Create a business from a Qore Catalog sub-type, turn its template into a starter inventory, send every decision back as feedback. Safe to retry.
- **[Barcode scan](architecture/barcode-scan.md)** — Scan to find an item in the merchant's inventory; link unknown barcodes once. One item per barcode, UPC-A = EAN-13.
- **[Vision recognition](architecture/vision-recognition.md)** — Shelf photo → inventory (Muse Spark reads, SAM 3.1 counts, Qore Catalog matches, the merchant confirms) and point-to-sell identify, with the API contract for the mobile app and the web stock-take page in apps/mp. Crops in R2 and an on-device model are *planned*.
- **[Stock-take agent](architecture/stocktake-agent.md)** — Muse Spark with tools (zoom, catalogue search, SAM count, store check) working through a shelf photo in the background until every line is settled; quick scan as first pass and fallback; the merchant confirms.
- **[Vision schema](architecture/vision-schema.md)** — How scans, detections, readings and stock-take runs relate; which links are foreign keys and which are values (Qore IDs, R2 crop keys, stock movement keys); who writes each row.
- **[Q Vision](architecture/qvision-distillation.md)**: moved to Qore Catalog.

### Diagrams

- **[Architecture diagrams](diagrams/README.md)** — C4 model, auth sequences, database isolation, migration flow, mobile layers and flavors, system flowchart and journeys.

## Guides

- **[Local development](guides/local-development.md)** — Setup, env, running every app.
- **[Database migrations](guides/database-migrations.md)** — Generate, review, apply on staging, hand to the CTO.
- **[Keeping docs current](guides/documentation.md)** — What to update when, and how to regenerate diagrams.

Deploy: the API ships as a Docker image to Coolify — see [apps/api README](../apps/api/README.md#deploy-coolify). A deploy guide for mp is planned.

## Contributing

- Branch from `staging`; PRs target `staging`. Never branch from or merge `origin/main`.
- Commit messages: conventional, lowercase (`feat(api): …`, `docs: …`), bulleted body for larger changes, no AI co-author.
- Money in reporting reads only paid amounts — never order totals.
- Feature configuration lives in DB columns, not env vars.
- Secrets never enter git: `pnpm install` turns on a pre-commit hook (`scripts/check-secrets.sh`) and CI runs the same check. Real values go in gitignored `.env` files, never in a `.env.example`. If a key is ever exposed, revoke it.
