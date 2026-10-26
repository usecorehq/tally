# Tally

Inventory, sales and Q Vision tooling for Qorelly merchants. Lives in the `tally`
schema of the shared Qorelly Supabase project and signs users in with Qorelly's
Supabase Auth. Product data comes from the Qore Catalog API.

| Path | What | Stack | Port |
| --- | --- | --- | --- |
| `apps/console` | Q Vision distillation console — upload images, train against Qore Catalog | Next.js 16, NextAuth v5 | 3000 |
| `apps/mp` | Merchant portal — signup, onboarding, POS, inventory | Next.js 16, NextAuth v5 | 3001 |
| `apps/api` | Tally backend | NestJS 11, Drizzle | 4100 |
| `apps/mobile` | Inventory + sales app (`qore_tally`) | Flutter, bloc/cubit, dartz, get_it | — |
| `services/train` | Distillation / training service | Python 3.12, FastAPI, uv | 4200 |
| `packages/db` | Drizzle schema + client (`tally` schema) | drizzle-orm, postgres.js | — |
| `packages/auth` | NextAuth over shared Supabase Auth | next-auth 5 beta | — |
| `packages/catalog-client` | Qore Catalog API client (`x-api-key`) | TS | — |
| `packages/ui` | Shared React components | React, Tailwind 4 | — |
| `packages/tsconfig` | Shared tsconfigs | — | — |

## Setup

```bash
cp .env.example .env   # one env file at the root for every app
pnpm install
pnpm dev               # console, mp, api (builds packages first)
```

Qore Catalog must be running (`QORE_CATALOG_BASE_URL`, default `http://localhost:3100`).

## Auth

Identity is the shared Qorelly `auth.users`.
- console / mp: NextAuth Credentials → `supabase.auth.signInWithPassword`; the Supabase
  access token rides in the NextAuth JWT (refreshed automatically).
- mobile: `supabase_flutter` directly.
- api: every route needs `Authorization: Bearer <supabase access_token>` unless `@Public()`.

## Database

Drizzle, `tally` schema only (`schemaFilter: ["tally"]`). Ledger is
`tally.__drizzle_migrations` — not the default `drizzle.__drizzle_migrations`, which bookmi
uses on the same database.

```bash
pnpm db:generate --name=<what_changed>   # always name migrations semantically
pnpm db:migrate                          # staging only; production is applied by the CTO
```

Applied migration files are frozen. Grants and tightenings never share a migration.
