# @tally/mp

Merchant portal — merchant signup, onboarding, stock-take from a shelf photo and inventory.

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
proxy.ts                         redirects to /login without a session (/design is open outside production)
app/loading.tsx                  the Tally mark while a fresh load waits for a page's own skeleton
app/login/page.tsx               email + password server action
app/api/auth/[...nextauth]/      NextAuth route handlers
app/_components/                 AppShell (V2 frame: sidebar nav, business switcher in the top bar, stock-take recents on /stocktake pages, white inset panel), TallyMark
lib/businesses.ts                the user's businesses and the current one: ?business=, then the tally-business cookie, then the first
app/(home)/page.tsx              home: onboarding when there's no business yet, else the current business's inventory
app/inventory/                   inventory (?business=<id>): scan card, search, Items / Units / Low stock tiles, stock list
app/onboarding/                  first-time setup wizard (Qorelly /setup port): business type → details → starter items; saves at Finish; home once a business exists
  [businessId]/items/            starter items for a business that already exists
app/businesses/new/              Add a business: the same wizard, with a close button back home (or back to consent via ?returnTo=/oauth/authorize…)
app/oauth/authorize/             Connect Tally consent: account chooser, business picker, Allow / Cancel (page or popup); not frameable
app/settings/                    Settings for the current business: integrations/ (connected apps, revoke), usage/ (today vs plan, 30 days, by source), plan/ (simulated subscribe)
  limit-reached.tsx              LimitReached: a 429 from a stock-take explained, with Upgrade
app/stocktake/                   new stock-take: business + photo, then the run continues at its own URL (?business=<id>)
  history/                       the business's stock-takes and quick scans, newest first, grouped by day, reruns nested
  history/[id]/                  one session (run or quick scan): progress (polling resumes after a refresh), review, or read-only
  recents.tsx                    the sidebar's "Take new stock" and Recents on stock-take pages
  scan-actions.tsx               Rerun (on the stored photo) and Discard (with a confirm) for a session
  entry-text.ts                  an entry's title (products read) and summary
  actions.ts                     server actions: start/poll the agent, quick scan, reopen a scan, history, confirm, catalogue search/product
  session.tsx                    a reopened session: run polling, review, confirmed or failed
  confirmed-view.tsx             a confirmed scan, read-only: each line's decision and when
  photo-store.ts                 a local copy of the shelf photo per session in IndexedDB, so it shows at once (the API keeps the stored one)
  urls.ts                        session, history and new stock-take URLs
  image.ts                       browser-side resize (2560 px JPEG) and per-product thumbnails
  stocktake-flow.tsx             photo picker for the current business, live agent trace
  review-table.tsx               one row per undecided detection: count, candidate, store status, action; then the outcome
  product-picker.tsx             the line's product sheet: suggestions with match strength, other sizes, catalogue search, new item
app/design/                      dev-only previews of the V2 kit and every page state with fixture data (connect/ and settings/ list their states)
lib/api.ts                       server-only api() to apps/api with the session's token; ApiError carries the API's `code` (or OAuth `error`)
lib/format.ts                    ₦ and quantity strings without floats
```

UI is Qorelly Design V2 from `@tally/ui`; open `/design` in dev to see every element.

The stock-take page is the web version of the shelf scan: see [Web stock-take](../../docs/architecture/vision-recognition.md#web-stock-take-apps-mp) and [Stock-take history](../../docs/architecture/vision-recognition.md#stock-take-history-built). It needs apps/api with `META_MODEL_API_KEY` set; without it the page shows "Photo recognition isn't set up on this server yet".

Calling the API from server code: `const session = await auth()` then send `Authorization: Bearer ${session.accessToken}`.

See [docs/architecture/auth.md](../../docs/architecture/auth.md).
