# @tally/mp

Merchant portal — merchant signup, onboarding, stock-take from a shelf photo, point of sale and inventory.

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
app/page.tsx                     home: the user's businesses, each with a Stock-take link
app/onboarding/                  setup wizard (Qorelly /setup port): business type → details → starter items; saves at Finish
  [businessId]/items/            starter items for a business that already exists
app/stocktake/                   shelf photo → review → confirm (?business=<id>)
  actions.ts                     server actions: start/poll the stock-take agent, quick scan, confirm
  image.ts                       browser-side resize (1600 px JPEG) and per-product thumbnails
  stocktake-flow.tsx             business + photo picker, live agent trace
  review-table.tsx               one row per detection: count, candidate, store status, action; then the outcome
```

The stock-take page is the web version of the shelf scan: see [Web stock-take](../../docs/architecture/vision-recognition.md#web-stock-take-apps-mp). It needs apps/api with `META_MODEL_API_KEY` set; without it the page shows "Photo recognition isn't set up on this server yet".

Calling the API from server code: `const session = await auth()` then send `Authorization: Bearer ${session.accessToken}`.

See [docs/architecture/auth.md](../../docs/architecture/auth.md).
