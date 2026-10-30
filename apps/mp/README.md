# @tally/mp

Merchant portal — merchant signup, onboarding, stock-take from a shelf photo and inventory. It also serves the stock-take as an iframe for connected partner apps ([Embedded stock-take](../../docs/architecture/embed.md)).

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
| `NEXT_PUBLIC_API_URL` | no | apps/api base, default `http://localhost:4100/api`. The embed calls it from the browser too. |
| `EMBED_HOST` | no | The iframe's host (for example `embed.tally.qorelly.com`): only `/embed/*` is served there, and `/embed/*` is a 404 on every other host. Unset in dev and on previews, where `/embed/*` is served on the main host. |

## Layout

```
auth.ts                          createTallyAuth() from @tally/auth → handlers, auth, signIn, signOut
proxy.ts                         redirects to /login without a session, keeping the query string in callbackUrl (/design is open outside production);
                                 host-gates EMBED_HOST and sets the embed's frame-ancestors
app/loading.tsx                  the Tally mark while a fresh load waits for a page's own skeleton
app/login/page.tsx               email + password server action
app/api/auth/[...nextauth]/      NextAuth route handlers
app/_components/                 AppShell (V2 frame: sidebar nav, stock-take recents on /stocktake pages, white inset panel), TallyMark
app/(home)/page.tsx              home (route group, so its loading.tsx covers home only): the user's businesses (name → inventory, Stock-take action)
app/inventory/                   inventory (?business=<id>): scan card, search, Items / Units / Low stock tiles, stock list
app/onboarding/                  first-time setup wizard (Qorelly /setup port): business type → details → starter items; saves at Finish; home once a business exists
  [businessId]/items/            starter items for a business that already exists
app/businesses/new/              Add a business: the same wizard, with a close button back home
app/stocktake/                   new stock-take: business + photo, then the run continues at its own URL (?business=<id>)
  history/                       the business's stock-takes and quick scans, newest first, grouped by day, reruns nested
  history/[id]/                  one session (run or quick scan): progress (polling resumes after a refresh), review, or read-only
  recents.tsx                    the sidebar's "Take new stock" and Recents on stock-take pages
  scan-actions.tsx               Rerun (on the stored photo) and Discard (with a confirm) for a session
  entry-text.ts                  an entry's title (products read) and summary
  actions.ts                     server actions: start/poll the agent, quick scan, reopen a scan, history, confirm, catalogue search/product
  api-context.tsx                the data layer and navigation the components use: server actions + URLs in mp, the embed's own in /embed
  session.tsx                    a reopened session: run polling, review, confirmed or failed
  confirmed-view.tsx             a confirmed scan, read-only: each line's decision and when
  photo-store.ts                 a local copy of the shelf photo per session in IndexedDB, so it shows at once (the API keeps the stored one)
  urls.ts                        session, history and new stock-take URLs
  image.ts                       browser-side resize (2560 px JPEG) and per-product thumbnails
  stocktake-flow.tsx             business + photo picker, live agent trace
  review-table.tsx               one row per undecided detection: count, candidate, store status, action; then the outcome
  product-picker.tsx             the line's product sheet: suggestions with match strength, other sizes, catalogue search, new item
app/embed/stocktake/             the stock-take as an iframe for partner apps: client lookup result from proxy.ts, postMessage protocol v1, theme, in-frame navigation
app/embed/harness/               dev and preview only: frames /embed/stocktake and plays the launcher's side, with a fixture client and fixture data
app/design/                      dev-only previews of the V2 kit and every page state with fixture data
lib/format.ts                    ₦ and quantity strings without floats
lib/embed-api.ts                 the embed's data layer: browser fetches with the embed session token, token refresh, limits
```

UI is Qorelly Design V2 from `@tally/ui`; open `/design` in dev to see every element.

The stock-take page is the web version of the shelf scan: see [Web stock-take](../../docs/architecture/vision-recognition.md#web-stock-take-apps-mp) and [Stock-take history](../../docs/architecture/vision-recognition.md#stock-take-history-built). It needs apps/api with `META_MODEL_API_KEY` set; without it the page shows "Photo recognition isn't set up on this server yet".

Calling the API from server code: `const session = await auth()` then send `Authorization: Bearer ${session.accessToken}`.

See [docs/architecture/auth.md](../../docs/architecture/auth.md).
