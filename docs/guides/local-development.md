# Local development

**Prerequisites:** Node ≥ 20.19 (repo uses 24), pnpm ≥ 10 (repo pins 12.3.4), Flutter (stable) for mobile, and a running Qore Catalog API.

## 1. Install

```bash
pnpm install
cp .env.example .env
```

`pnpm install` also enables the secret-scanning pre-commit hook (`git config core.hooksPath .githooks`). Run `pnpm check:secrets` to scan every tracked file.

## 2. Fill `.env`

The repo-root `.env` is read by every app. An app may also have its own `apps/<app>/.env` (template: `apps/<app>/.env.example`); its keys win, anything missing falls back to the root.

| Var | Used by | Where to get it |
|---|---|---|
| `QORE_CATALOG_BASE_URL` | api | `http://localhost:3100` locally |
| `QORE_CATALOG_API_KEY` | api | Qore Catalog `api_keys` (server-only; mp never needs it) |
| `META_MODEL_API_KEY` | api | Meta Model API key (`LLM_…`), server-only. Optional: without it only the vision routes are unavailable |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | api | Cloudflare R2 bucket `tally-media`, token scoped to it, server-only. Optional: without them product crops are skipped |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | mp (NextAuth), api | Qorelly Supabase project |
| `SUPABASE_JWT_SECRET` | api | Qorelly Supabase → API → JWT settings |
| `SUPABASE_DB_URL` | api, drizzle-kit | Staging Postgres connection string |
| `AUTH_SECRET` | mp | `openssl rand -base64 32` |
| `EMBED_HOST` | mp | Leave unset locally: `/embed/*` is then served on localhost ([Embedded stock-take](../architecture/embed.md)) |
| `PORT`, `CORS_ORIGINS` | api | defaults in `.env.example` |

The mobile app does not read this file — it has its own per-flavor `apps/mobile/.env.<flavor>` (see below).

## 3. Run

```bash
pnpm dev                                   # builds packages, then api + mp
pnpm --filter @tally/api dev               # just the API
pnpm --filter @tally/mp dev                # just mp
```

| URL | What |
|---|---|
| http://localhost:3001 | mp |
| http://localhost:4100/api/health | API health (+ catalog status) |
| http://localhost:4100/docs | Swagger — paste a Supabase access token |

Mobile (Flutter stable; Android: JDK 17 + Android SDK; iOS: Xcode + CocoaPods):

```bash
cd apps/mobile
cp .env.example .env.dev        # fill SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY; TALLY_API_URL optional for dev
flutter pub get
flutter run --flavor dev -t lib/main_dev.dart --dart-define-from-file=.env.dev
```

With the API running locally, the dev flavor reaches it at `10.0.2.2:4100` (Android emulator) or `127.0.0.1:4100` (iOS simulator). Staging/prod and everything else: [`apps/mobile/README.md`](../../apps/mobile/README.md#flavors) and [mobile flavors](../architecture/mobile-flavors.md).

## 4. Checks (same as CI)

```bash
pnpm typecheck && pnpm test && pnpm db:check && pnpm build
(cd apps/mobile && flutter analyze && flutter test && flutter build apk --debug --flavor dev -t lib/main_dev.dart)
```

### What CI runs, and when

| Job | Runs automatically when | Does |
|---|---|---|
| `secrets` | every PR and push to `staging` | secret scan (~5 s) |
| `web` | `apps/api`, `apps/mp`, `packages/**`, root workspace/lockfile files change | typecheck, test, db:check, build |
| `mobile` | `apps/mobile/**` changes | analyze, test, dev APK (~5 min) |

Any change to `.github/workflows/**` runs all of them. A newer push to the same branch cancels the older run.

Run any job on demand (e.g. `mobile` before a release): **Actions → ci → Run workflow**, pick the branch and jobs, or:

```bash
gh workflow run ci.yml --ref staging -f web=true -f mobile=true
```
