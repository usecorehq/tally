# Local development

**Prerequisites:** Node ≥ 20.19 (repo uses 24), pnpm ≥ 10 (repo pins 12.3.4), Python 3.12 + [uv](https://docs.astral.sh/uv/), Flutter (stable) for mobile, and a running Qore Catalog API.

## 1. Install

```bash
pnpm install
cp .env.example .env
```

## 2. Fill `.env`

The repo-root `.env` is read by every app. An app may also have its own `apps/<app>/.env` (template: `apps/<app>/.env.example`); its keys win, anything missing falls back to the root.

| Var | Used by | Where to get it |
|---|---|---|
| `QORE_CATALOG_BASE_URL` | api, mp, console, train | `http://localhost:3100` locally |
| `QORE_CATALOG_API_KEY` | api, mp, console, train | Qore Catalog `api_keys` (server-only) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | mp, console (NextAuth), api | Qorelly Supabase project |
| `SUPABASE_JWT_SECRET` | api | Qorelly Supabase → API → JWT settings |
| `SUPABASE_DB_URL` | api, drizzle-kit | Staging Postgres connection string |
| `AUTH_SECRET` | mp, console | `openssl rand -base64 32` |
| `PORT`, `CORS_ORIGINS` | api | defaults in `.env.example` |

## 3. Run

```bash
pnpm dev                                   # builds packages, then api + mp + console
pnpm --filter @tally/api dev               # just the API
pnpm --filter @tally/mp dev                # just mp
```

| URL | What |
|---|---|
| http://localhost:3000 | console |
| http://localhost:3001 | mp |
| http://localhost:4100/api/health | API health (+ catalog status) |
| http://localhost:4100/docs | Swagger — paste a Supabase access token |

Train service:

```bash
cd services/train && uv sync && uv run uvicorn train.main:app --reload --port 4200
```

Mobile: see [`apps/mobile/README.md`](../../apps/mobile/README.md).

## 4. Checks (same as CI)

```bash
pnpm typecheck && pnpm build
(cd services/train && uv run ruff check . && uv run pytest -q)
(cd apps/mobile && flutter analyze && flutter test)
```
