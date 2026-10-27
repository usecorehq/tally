# Tally — by Qorelly

> Inventory and point of sale for Nigerian SMEs, plus the Q Vision console that trains product-recognition models against the Qore Catalog.

- **Merchants** sign in with their Qorelly account and run stock and sales from the web portal (`mp`) or the mobile app (`qore_tally`).
- **Q Vision operators** upload product images in the `console`, link them to Qore Catalog products, and run distillation in `services/train`.
- **Tally** lives in the `tally` schema of the shared Qorelly Supabase project and reuses Qorelly's `auth.users`.

Status: scaffold. Sign-in works on every surface; onboarding, inventory, POS and Q Vision flows are planned (see the [system flowchart](docs/diagrams/images/system-flowchart.svg)).

---

## Stack at a glance

| Layer | Tech |
|---|---|
| Web | Next.js 16 (App Router), Tailwind 4, NextAuth v5 (Credentials → Supabase) — `apps/mp`, `apps/console` |
| Mobile | Flutter, clean architecture, flutter_bloc (bloc + cubit), dartz `Either`, get_it, supabase_flutter, Dio — `apps/mobile` |
| Backend | NestJS 11, Drizzle on `postgres.js`, class-validator env, Swagger at `/docs` — `apps/api` |
| Training | Python 3.12, FastAPI, uv — `services/train` |
| DB | Shared Qorelly Supabase Postgres, `tally` schema only; ledger `tally.__drizzle_migrations` |
| Auth | Qorelly Supabase Auth. API verifies JWTs (HS256 or JWKS), `audience: authenticated` enforced |
| Product data | Qore Catalog API (`/v1`, `x-api-key`, server-only) |

---

## Quick start

**Prerequisites:** Node ≥ 20.19, pnpm ≥ 10, Python 3.12 + uv, Flutter (for mobile), a running Qore Catalog API, and access to the Qorelly Supabase staging project.

```bash
pnpm install
cp .env.example .env          # one root env; apps may also have their own .env (see each app's .env.example)
# fill Supabase + Qore Catalog values — docs/guides/local-development.md
pnpm dev                      # builds packages, then api + mp + console
```

| URL | What |
|---|---|
| http://localhost:3000 | console |
| http://localhost:3001 | mp (merchant portal) |
| http://localhost:4100/api/health | API health + Qore Catalog status |
| http://localhost:4100/docs | Swagger — paste a Supabase access token |
| http://localhost:4200/health | train service (`uv run uvicorn train.main:app --port 4200`) |

Full walkthrough: **[docs/guides/local-development.md](docs/guides/local-development.md)**.

---

## Monorepo layout

```
apps/
  api/               NestJS + Drizzle. Global SupabaseJwtGuard, health, catalog.   README + .env.example
  console/           Next.js. Q Vision distillation console.                       README + .env.example
  mp/                Next.js. Merchant portal: signup, onboarding, POS, inventory.  README + .env.example
  mobile/            Flutter app qore_tally (clean architecture, bloc/cubit).       README
services/
  train/             FastAPI + uv. Q Vision training / distillation.                README
packages/
  db/                Drizzle schema + client for the tally schema, migrations/.
  auth/              NextAuth v5 config over shared Supabase Auth.
  catalog-client/    Qore Catalog API client (x-api-key).
  ui/                Shared React components (rounded-full, no shadows).
  tsconfig/          base.json, node.json, next.json.
docs/
  architecture/      Why we built it this way.
  guides/            How to run, migrate, and keep docs current.
  diagrams/          C4 model, sequences, flows, journeys (mermaid/ source, images/ SVG).
```

---

## Documentation

Everything lives under [`docs/`](docs/README.md). Docs ship in the same PR as the code they describe.

<table>
<tr>
<td align="center"><img src="docs/diagrams/images/c4-context.svg" alt="Tally C4 system context diagram" width="450"><br/><b>A</b> — C4 Context: merchants, Q Vision operators, Tally, the shared Qorelly Supabase and the Qore Catalog API</td>
<td align="center"><img src="docs/diagrams/images/c4-container.svg" alt="Tally C4 container diagram" width="450"><br/><b>B</b> — C4 Container: mp, console, mobile, api, train and Postgres, and how they authenticate and talk</td>
</tr>
</table>

More in **[Architecture diagrams](docs/diagrams/README.md)**: auth sequences (web + mobile), database isolation, migration flow, mobile layers, system flowchart, Q Vision flow, merchant journey.

### Architecture

- **[Auth](docs/architecture/auth.md)** — One identity (Qorelly `auth.users`), three session holders, one API guard.
- **[Database](docs/architecture/database.md)** — `tally` schema in a shared database, and why our ledger isn't Drizzle's default.
- **[Qore Catalog integration](docs/architecture/catalog.md)** — Where the API key may and may not go.
- **[Mobile app](docs/architecture/mobile.md)** — Layers, `Either<Failure, T>`, get_it, bloc vs cubit.
- **[Q Vision distillation](docs/architecture/qvision-distillation.md)** — Planned flow and the open questions.

### Guides

- **[Local development](docs/guides/local-development.md)**
- **[Database migrations](docs/guides/database-migrations.md)**
- **[Keeping docs current](docs/guides/documentation.md)**

---

## Common commands

```bash
# Dev
pnpm dev                              # every app (packages built first)
pnpm --filter @tally/api dev
pnpm --filter @tally/mp dev
pnpm --filter @tally/console dev
(cd apps/mobile && flutter run --flavor dev -t lib/main_dev.dart --dart-define-from-file=.env.dev)   # flavors: apps/mobile/README.md

# Quality
pnpm typecheck
pnpm build
(cd services/train && uv run ruff check . && uv run pytest -q)
(cd apps/mobile && flutter analyze && flutter test)

# Database (staging only — production is applied by the CTO)
pnpm db:generate --name=<what_changed>
pnpm db:migrate
pnpm db:studio

# Docs
pnpm docs:diagrams                    # re-render every Mermaid diagram
pnpm docs:diagrams c4-container       # just one
```

---

## Contributing

Branch from `staging`, PR into `staging`. Conventional commits (`feat(api): …`, `docs: …`), no AI co-author. See [docs/README.md](docs/README.md#contributing).
