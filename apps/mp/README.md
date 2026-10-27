# @tally/mp

Merchant portal — merchant signup, onboarding, point of sale and inventory.

Next.js 16 (App Router), Tailwind 4, NextAuth v5 over the shared Qorelly Supabase Auth.

## Run

```bash
cp apps/mp/.env.example apps/mp/.env   # or fill the repo-root .env — both are read
pnpm --filter @tally/mp dev            # http://localhost:3001
```

## Env

| Var | Required | Notes |
|---|---|---|
| `AUTH_SECRET` | yes | NextAuth cookie encryption |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | yes | Sign-in against Qorelly Supabase Auth |
| `NEXT_PUBLIC_API_URL` | no | apps/api base, default `http://localhost:4100/api` |

## Layout

```
auth.ts                          createTallyAuth() from @tally/auth → handlers, auth, signIn, signOut
proxy.ts                         redirects to /login without a session
app/login/page.tsx               email + password server action
app/api/auth/[...nextauth]/      NextAuth route handlers
app/page.tsx                     home: signed-in user + Tally API / catalogue status from GET /api/health (placeholder)
```

Calling the API from server code: `const session = await auth()` then send `Authorization: Bearer ${session.accessToken}`.

See [docs/architecture/auth.md](../../docs/architecture/auth.md).
