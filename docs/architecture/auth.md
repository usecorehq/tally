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

Ported from bookmi. Every route requires a valid Supabase user JWT unless the controller or handler is marked `@Public()` (health checks, provider webhooks, and the Connect Tally token and revoke endpoints, which authenticate the client with HTTP Basic instead).

- `HS256` → verified with `SUPABASE_JWT_SECRET`.
- `ES256` / `RS256` → verified against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, for when the project moves to asymmetric keys.
- `audience: authenticated` is enforced and `role` must not be `anon` or `service_role`, so API keys can never act as users.
- `@CurrentUser()` exposes `{ sub, email, role, session_id }`; `sub` is the `auth.users` id.

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

- **Errors.** The OAuth endpoints answer with the RFC 6749 body `{ error, error_description }`. An unknown or suspended client, or a `redirect_uri` that isn't registered exactly, is `invalid_client`: the consent page must not redirect back for those. `invalid_request` and `invalid_scope` are only raised after the client and redirect URI check out. Token-endpoint client failures are 401 `invalid_client`.
- **Secrets at rest.** The client secret, codes and refresh tokens are stored only as sha256 hex. The secret is compared in constant time.
- **PKCE.** Only `S256`. The token endpoint checks `base64url(sha256(code_verifier)) === code_challenge` and that the code is unused, unexpired, and issued to the same client and `redirect_uri`. The code is marked used in the same transaction that creates the grant; a failed exchange leaves it unused.
- **Grants.** One active grant per client and business: reconnecting revokes the old one first.
- **Access token.** HS256 JWT signed with `TALLY_CLIENT_JWT_SECRET` (never the Supabase secret), lives 900 s: `iss: tally`, `aud: tally-client`, `sub` (the merchant), `bid` (business), `cid` (`oauth_clients.id`), `gid` (grant), `scope`, `jti`.
- **Refresh token.** Opaque, 30-day sliding expiry, rotated on every use. Presenting a token that was already rotated out revokes the whole grant (replay detection).
- **Revocation.** A revoked grant's refresh token stops working at once, whether revoked by the client (`oauth/revoke`), the merchant (`DELETE grants/:id`), a reconnect or a replay.

Planned: the consent screen in mp (`/oauth/authorize`), and the API guard that accepts these access tokens (and embed session tokens) with per-route scopes, the business match and the grant-revocation check. Until the guard lands, access tokens are issued but not yet accepted by any route.

## Not built yet

- Signup on mp. Mobile signs up with `supabase.auth.signUp` against the shared project, exactly as Qorelly does: `full_name`, E.164 `phone` and `role: owner` in user metadata, which Qorelly's `handle_new_user` trigger turns into its profile row. Tally writes nothing outside the `tally` schema (no profile upsert). Email confirmation is on, so the app asks for the emailed code; an already-registered email (a stand-in user with no identities) is reported, not sent a code.
- Roles / authorisation beyond "is a signed-in user".
