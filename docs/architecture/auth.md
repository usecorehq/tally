# Auth

> Diagrams: [web sequence](../diagrams/images/auth-web-sequence.svg) · [mobile sequence](../diagrams/images/auth-mobile-sequence.svg)

Tally has no user table of its own. Identity is the shared Qorelly Supabase `auth.users`: a merchant signs into Tally with the same email and password they use for Qorelly, and every tally row that belongs to a person references `auth.users(id)`.

## Who does what

| Surface | Session held by | How it gets a token | Code |
|---|---|---|---|
| mp, console | NextAuth v5 (encrypted JWT cookie) | Credentials provider → `supabase.auth.signInWithPassword` | `packages/auth`, `apps/*/auth.ts`, `apps/*/proxy.ts` |
| mobile | `supabase_flutter` (persisted via shared_preferences by default) | `signInWithPassword` in `AuthRemoteDataSource` | `apps/mobile/lib/features/auth` |
| api | — (stateless) | Verifies the `Authorization: Bearer` header | `apps/api/src/common/guards/supabase-jwt.guard.ts` |

## Why NextAuth in front of Supabase

The web apps use NextAuth so session handling, route protection (`proxy.ts`) and server actions follow the standard Next.js App Router pattern. Supabase stays the identity provider. The Supabase `access_token`, `refresh_token` and `expires_at` live inside the NextAuth JWT; the `jwt` callback refreshes them when fewer than 60 s remain. `session.accessToken` is what server code sends to the API.

If a refresh fails, `session.error` is `"RefreshFailed"` — callers should sign the user out.

NextAuth v5 is still published under npm's `beta` tag (`5.0.0-beta.32`, pinned exactly). v4 is the `latest` tag but predates first-class App Router support.

## API guard

Ported from bookmi. Every route requires a valid Supabase user JWT unless the controller or handler is marked `@Public()` (health checks and provider webhooks only).

- `HS256` → verified with `SUPABASE_JWT_SECRET`.
- `ES256` / `RS256` → verified against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, for when the project moves to asymmetric keys.
- `audience: authenticated` is enforced and `role` must not be `anon` or `service_role`, so API keys can never act as users.
- `@CurrentUser()` exposes `{ sub, email, role, session_id }`; `sub` is the `auth.users` id.

## Not built yet

- Merchant signup and onboarding (mp). Signup will need a decision: create the account in Qorelly's flow, or call `supabase.auth.signUp` from Tally.
- Roles / authorisation beyond "is a signed-in user" (e.g. console restricted to Core Technologies staff).
