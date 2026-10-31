# Auth


Tally has no user table of its own. Identity is the shared Qorelly Supabase `auth.users`: a merchant signs into Tally with the same email and password they use for Qorelly, and every tally row that belongs to a person references `auth.users(id)`.

## Who does what

| Surface | Session held by | How it gets a token | Code |
|---|---|---|---|
| mp | NextAuth v5 (encrypted JWT cookie) | Credentials provider → `supabase.auth.signInWithPassword` | `packages/auth`, `apps/mp/auth.ts`, `apps/mp/proxy.ts` |
| mobile | `supabase_flutter` (persisted via shared_preferences by default) | `signInWithPassword`, `signUp` + email code (`verifyOTP`), password reset in `AuthRemoteDataSource` | `apps/mobile/lib/features/auth` |
| api | — (stateless) | Verifies the `Authorization: Bearer` header | `apps/api/src/common/guards/auth.guard.ts` |

## Why NextAuth in front of Supabase

The web app (mp) uses NextAuth so session handling, route protection (`proxy.ts`) and server actions follow the standard Next.js App Router pattern. Supabase stays the identity provider. The Supabase `access_token`, `refresh_token` and `expires_at` live inside the NextAuth JWT; the `jwt` callback refreshes them when fewer than 60 s remain. `session.accessToken` is what server code sends to the API.

If a refresh fails, `session.error` is `"RefreshFailed"` — callers should sign the user out.

NextAuth v5 is still published under npm's `beta` tag (`5.0.0-beta.32`, pinned exactly). v4 is the `latest` tag but predates first-class App Router support.

## API guard

`AuthGuard` (global; ported from bookmi as `SupabaseJwtGuard`, which is kept as an alias). Every route needs a bearer token unless the controller or handler is marked `@Public()`: health checks, provider webhooks, the Connect Tally token and revoke endpoints (the client authenticates with HTTP Basic instead), and the embed config.

Supabase user tokens (`kind: "user"`):

- `HS256` → verified with `SUPABASE_JWT_SECRET`.
- `ES256` / `RS256` → verified against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, for when the project moves to asymmetric keys.
- `audience: authenticated` is enforced and `role` must not be `anon` or `service_role`, so API keys can never act as users.

Connect Tally tokens (`kind: "client"` for `aud: tally-client`, `kind: "embed"` for `aud: tally-embed`) are verified only with `TALLY_CLIENT_JWT_SECRET`: HS256, the audience pinned and `iss: tally`. A token signed with one secret never verifies under the other. Then:

- the grant must not be revoked, checked against `oauth_grants` with a cache of at most 60 s, so a revoke lands within a minute. Otherwise 401 `code: grant_revoked`. An expired token is 401 `code: token_expired`;
- the handler must carry `@Scopes(...)`, otherwise 403 `code: client_not_allowed`. Creating or listing businesses, `identify`, and every other route without it are user-only;
- the token must hold every scope listed, otherwise 403 `code: insufficient_scope`;
- a route's `:businessId` must equal the token's business, otherwise 403 `code: business_mismatch`;
- membership is still checked by each service as for users (`sub` is the merchant who consented).

`@CurrentUser()` exposes the principal: `{ kind, sub, email, role, aud, session_id }` for users, and `{ kind, sub, aud, clientId, grantId, businessId, scopes }` for client and embed tokens. `sub` is always the `auth.users` id.

## Connect Tally

Partner apps ("clients") get a merchant's consent through OAuth 2.0 (authorization code + PKCE `S256`) and then call Tally's API for that one business, or embed Tally's stock-take in an iframe. Clients are registered with `apps/api/scripts/oauth-client-create.mjs`; the tables are `oauth_clients`, `oauth_codes` and `oauth_grants` (see [Database](database.md#oauth-clients-connect-tally)). Code: `apps/api/src/modules/clients/`.

| Endpoint (under `/api/clients/v1`) | Auth | Does |
|---|---|---|
| `GET oauth/authorize-info?client_id&redirect_uri&scope` | Supabase user | Consent screen data: the client, the scopes in plain words, and the caller's owned businesses with a `connected` flag |
| `POST oauth/codes` | Supabase user, owner of `business_id` | Approves the consent: a single-use code (60 s) bound to the client, redirect URI, scopes, business and PKCE challenge. 403 `code: not_owner` otherwise |
| `POST oauth/token` | Public; client HTTP Basic | `grant_type=authorization_code` (with `code`, `redirect_uri`, `code_verifier`) or `grant_type=refresh_token`. Form-urlencoded or JSON |
| `POST oauth/revoke` | Public; client HTTP Basic | `token=<refresh token>` revokes its grant. 200 `{}` for any token once the client authenticates (RFC 7009) |
| `GET grants?businessId` | Supabase user, owner | The business's connected apps |
| `DELETE grants/:id` | Supabase user, owner | Disconnects an app (204) |
| `GET me` | Access token | `{ client_id, business: { id, name }, scopes }` |
| `POST sessions` | Access token with `stocktake:write` | An embed session token for the iframe: the same claims with `aud: tally-embed`, 900 s. `{ session_token, expires_at, business_id }` |
| `GET embed-config?client_id` | Public | `{ client_id, name, status, allowed_origins, theme }` for the embed page server; nothing secret. 404 `code: unknown_client` |

- **Errors.** The OAuth endpoints answer with the RFC 6749 body `{ error, error_description }`. An unknown or suspended client, or a `redirect_uri` that isn't registered exactly, is `invalid_client`: the consent page must not redirect back for those. `invalid_request` and `invalid_scope` are only raised after the client and redirect URI check out. Token-endpoint client failures are 401 `invalid_client`.
- **Secrets at rest.** The client secret, codes and refresh tokens are stored only as sha256 hex. The secret is compared in constant time.
- **PKCE.** Only `S256`. The token endpoint checks `base64url(sha256(code_verifier)) === code_challenge` and that the code is unused, unexpired, and issued to the same client and `redirect_uri`. The code is marked used in the same transaction that creates the grant; a failed exchange leaves it unused.
- **Grants.** One active grant per client and business: reconnecting revokes the old one first.
- **Access token.** HS256 JWT signed with `TALLY_CLIENT_JWT_SECRET` (never the Supabase secret), lives 900 s: `iss: tally`, `aud: tally-client`, `sub` (the merchant), `bid` (business), `cid` (`oauth_clients.id`), `gid` (grant), `scope`, `jti`.
- **Refresh token.** Opaque, 30-day sliding expiry, rotated on every use. Presenting a token that was already rotated out revokes the whole grant (replay detection).
- **Revocation.** A revoked grant's refresh token stops working at once, whether revoked by the client (`oauth/revoke`), the merchant (`DELETE grants/:id`), a reconnect or a replay.

### Scopes

| Scope | Routes |
|---|---|
| `stocktake:write` | POST `businesses/:businessId/vision/shelf-scans`, `…/stocktakes`, `…/photo-check`, `…/shelf-scans/:scanId/rerun`, `…/discard`, `…/confirm`; GET `catalog/products`, `catalog/products/:qid`; POST `clients/v1/sessions` |
| `stocktake:read` | GET `…/vision/stocktakes`, `…/vision/stocktakes/:runId`, `…/vision/shelf-scans/:scanId` |
| `inventory:read` | GET `businesses/:businessId`, `businesses/:businessId/inventory`, `businesses/:businessId/inventory/barcode/:code` |

`GET clients/v1/me` takes any access token. `src/common/decorators/scopes.spec.ts` pins this table to the code.

### Sessions

The partner's server calls `POST sessions` with its access token and hands the session token to the iframe (`@qorelly/tally-embed`), which keeps it in memory and asks the host for a new one before it expires. Only a `tally-client` token can mint sessions or read `me`; an embed token is 403 `code: client_token_required` there.

### Rate limits

`@nestjs/throttler`, in memory per API process, keyed on the grant or client rather than the IP (a partner's servers act for many merchants). 429 with `code: rate_limited` and `Retry-After-<name>`.

| Throttler | Limit | Applies to |
|---|---|---|
| `grant` | 60 a minute per grant | Every request with a client or embed token |
| `client` | 10 a minute per client | `POST oauth/token` (keyed on the Basic `client_id`) and `POST sessions` |
| `ip` | 60 a minute per IP | `GET embed-config` |

Supabase users are not throttled.

### CORS

The iframe calls the API from the browser, so `CORS_ORIGINS` on staging and production must include `https://<EMBED_HOST>` (for example `https://embed.tally.qorelly.com`). Partners call the API from their servers and need no CORS entry.

## Connect Tally (merchant side)

mp owns the screens; apps/api owns the codes, grants, tokens, usage, plans and subscriptions (above).

- **Consent: `/oauth/authorize`** (`apps/mp/app/oauth/authorize/`). No app shell, always Tally's own brand. `display=popup` is a compact layout that fits 480×640.
  1. Without `client_id` and `redirect_uri` there is nowhere safe to answer, so it shows an error.
  2. Signed out: the page itself redirects to `/login?callbackUrl=<path + full query>`.
  3. `GET /clients/v1/oauth/authorize-info` validates the request. `invalid_client` or a redirect mismatch shows an error and never redirects. `invalid_scope` / `invalid_request`, a `response_type` other than `code` and a missing S256 challenge go back to `redirect_uri?error=…&state=…`.
  4. Account chooser ("Continue as …" / "Use another account", which signs out and comes back through login), business picker (owned businesses only, "Connected" where a grant already exists; skipped with one business), then consent: each scope in plain words, Cancel and Allow.
  5. Allow is a server action that posts `/clients/v1/oauth/codes` and redirects to `redirect_uri?code&state`; Cancel redirects with `error=access_denied`. The request's params are closed over by the action (Next encrypts them), so a posted form can't swap the redirect target, and server actions only run from the same origin.
  6. `next.config.ts` sends `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY` on `/oauth/*`, so consent can't be framed.
  - No owned business: "Create a business" opens `/businesses/new?returnTo=<the consent path>`, which comes straight back after setup. `returnTo` is honoured only as a same-origin `/oauth/authorize` path.
- **Settings** (`apps/mp/app/settings/`, for the current business from the top-bar switcher, like Inventory):
  - Integrations: the business's connected apps (`GET /clients/v1/grants`), with scopes, dates, this month's share of stock-takes and Revoke (`DELETE /clients/v1/grants/:id`). Owners only.
  - Usage: today's stock-takes and quick scans against the plan's daily limit (it counts both), this month's totals, 30 days of stock-takes and quick scans, and stock-takes by source.
  - Plan: the current plan and the plans to compare. Subscribing is simulated: a confirm titled "Simulated subscription: no charge", no payment details, no charge. Plan prices are display-only and never revenue.
  - `LimitReached` (`app/settings/limit-reached.tsx`) explains a 429 (`plan_limit`, `client_cap`, `concurrent_runs`) and links to Plan.

## Not built yet

- Signup on mp. Mobile signs up with `supabase.auth.signUp` against the shared project, exactly as Qorelly does: `full_name`, E.164 `phone` and `role: owner` in user metadata, which Qorelly's `handle_new_user` trigger turns into its profile row. Tally writes nothing outside the `tally` schema (no profile upsert). Email confirmation is on, so the app asks for the emailed code; an already-registered email (a stand-in user with no identities) is reported, not sent a code.
- Roles / authorisation beyond "is a signed-in user".
