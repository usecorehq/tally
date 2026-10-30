# Auth


Tally has no user table of its own. Identity is the shared Qorelly Supabase `auth.users`: a merchant signs into Tally with the same email and password they use for Qorelly, and every tally row that belongs to a person references `auth.users(id)`.

## Who does what

| Surface | Session held by | How it gets a token | Code |
|---|---|---|---|
| mp | NextAuth v5 (encrypted JWT cookie) | Credentials provider → `supabase.auth.signInWithPassword` | `packages/auth`, `apps/mp/auth.ts`, `apps/mp/proxy.ts` |
| mobile | `supabase_flutter` (persisted via shared_preferences by default) | `signInWithPassword`, `signUp` + email code (`verifyOTP`), password reset in `AuthRemoteDataSource` | `apps/mobile/lib/features/auth` |
| api | — (stateless) | Verifies the `Authorization: Bearer` header | `apps/api/src/common/guards/supabase-jwt.guard.ts` |

## Why NextAuth in front of Supabase

The web app (mp) uses NextAuth so session handling, route protection (`proxy.ts`) and server actions follow the standard Next.js App Router pattern. Supabase stays the identity provider. The Supabase `access_token`, `refresh_token` and `expires_at` live inside the NextAuth JWT; the `jwt` callback refreshes them when fewer than 60 s remain. `session.accessToken` is what server code sends to the API.

If a refresh fails, `session.error` is `"RefreshFailed"` — callers should sign the user out.

NextAuth v5 is still published under npm's `beta` tag (`5.0.0-beta.32`, pinned exactly). v4 is the `latest` tag but predates first-class App Router support.

## API guard

Ported from bookmi. Every route requires a valid Supabase user JWT unless the controller or handler is marked `@Public()` (health checks and provider webhooks only).

- `HS256` → verified with `SUPABASE_JWT_SECRET`.
- `ES256` / `RS256` → verified against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, for when the project moves to asymmetric keys.
- `audience: authenticated` is enforced and `role` must not be `anon` or `service_role`, so API keys can never act as users.
- `@CurrentUser()` exposes `{ sub, email, role, session_id }`; `sub` is the `auth.users` id.

## Connect Tally (merchant side)

Partner apps ask a merchant for access with OAuth 2.0 (authorization code + PKCE). mp owns the screens; apps/api owns the codes, grants and tokens (the `/clients/v1/*` endpoints are planned and land separately, so these screens show their failed state until then).

- **Consent: `/oauth/authorize`** (`apps/mp/app/oauth/authorize/`). No app shell, always Tally's own brand. `display=popup` is a compact layout that fits 480×640.
  1. Without `client_id` and `redirect_uri` there is nowhere safe to answer, so it shows an error.
  2. Signed out: the page itself redirects to `/login?callbackUrl=<path + full query>`.
  3. `GET /clients/v1/oauth/authorize-info` validates the request. `invalid_client` or a redirect mismatch shows an error and never redirects. `invalid_scope` / `invalid_request`, a `response_type` other than `code` and a missing S256 challenge go back to `redirect_uri?error=…&state=…`.
  4. Account chooser ("Continue as …" / "Use another account", which signs out and comes back through login), business picker (owned businesses only, "Connected" where a grant already exists; skipped with one business), then consent: each scope in plain words, Cancel and Allow.
  5. Allow is a server action that posts `/clients/v1/oauth/codes` and redirects to `redirect_uri?code&state`; Cancel redirects with `error=access_denied`. The request's params are closed over by the action (Next encrypts them), so a posted form can't swap the redirect target, and server actions only run from the same origin.
  6. `next.config.ts` sends `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY` on `/oauth/*`, so consent can't be framed.
  - No owned business: "Create a business" opens `/businesses/new?returnTo=<the consent path>`, which comes straight back after setup. `returnTo` is honoured only as a same-origin `/oauth/authorize` path.
- **Settings** (`apps/mp/app/settings/`, `?business=<id>` like Inventory):
  - Integrations: the business's connected apps (`GET /clients/v1/grants`), with scopes, dates, this month's share of stock-takes and Revoke (`DELETE /clients/v1/grants/:id`). Owners only.
  - Usage: today's stock-takes against the plan's daily limit, this month's totals, 30 days of stock-takes and quick scans, and stock-takes by source.
  - Plan: the current plan and the plans to compare. Subscribing is simulated: a confirm titled "Simulated subscription: no charge", no payment details, no charge. Plan prices are display-only and never revenue.
  - `LimitReached` (`app/settings/limit-reached.tsx`) explains a 429 (`plan_limit`, `client_cap`, `concurrent_runs`) and links to Plan.

## Not built yet

- Signup on mp. Mobile signs up with `supabase.auth.signUp` against the shared project, exactly as Qorelly does: `full_name`, E.164 `phone` and `role: owner` in user metadata, which Qorelly's `handle_new_user` trigger turns into its profile row. Tally writes nothing outside the `tally` schema (no profile upsert). Email confirmation is on, so the app asks for the emailed code; an already-registered email (a stand-in user with no identities) is reported, not sent a code.
- Roles / authorisation beyond "is a signed-in user".
