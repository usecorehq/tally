# @tally/mp

Merchant portal — the public landing page, merchant signup, onboarding, stock-take from a shelf photo and inventory.

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
proxy.ts                         redirects to /login without a session (/ and public/landing/ are open; /design is open outside production)
app/login/page.tsx               email + password server action
app/api/auth/[...nextauth]/      NextAuth route handlers
app/_components/                 AppShell (V2 frame: sidebar nav, stock-take recents on /stocktake pages, white inset panel), TallyMark (the logo, inline SVG; `app/icon.svg` is the favicon)
app/(home)/page.tsx              / : signed out, the landing page; signed in, the user's businesses (name → inventory, Stock-take action)
app/_landing/                    the landing page (light only, whatever the portal theme): see Landing page below
app/inventory/                   inventory (?business=<id>): scan card, search, Items / Units / Low stock tiles, stock list
app/onboarding/                  setup wizard (Qorelly /setup port): business type → details → starter items; saves at Finish
  [businessId]/items/            starter items for a business that already exists
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
  stocktake-flow.tsx             business + photo picker, live agent trace
  review-table.tsx               one row per undecided detection: count, candidate, store status, action; then the outcome
  product-picker.tsx             the line's product sheet: suggestions with match strength, other sizes, catalogue search, new item
app/design/                      dev-only previews of the V2 kit and every page state with fixture data
lib/format.ts                    ₦ and quantity strings without floats
```

UI is Qorelly Design V2 from `@tally/ui`; open `/design` in dev to see every element.

The stock-take page is the web version of the shelf scan: see [Web stock-take](../../docs/architecture/vision-recognition.md#web-stock-take-apps-mp) and [Stock-take history](../../docs/architecture/vision-recognition.md#stock-take-history-built). It needs apps/api with `META_MODEL_API_KEY` set; without it the page shows "Photo recognition isn't set up on this server yet".

Calling the API from server code: `const session = await auth()` then send `Authorization: Bearer ${session.accessToken}`.

See [docs/architecture/auth.md](../../docs/architecture/auth.md).

## Landing page

Signed-out visitors get it at `/`; it forces the light theme while open and restores the saved one when you leave. Assets live in `public/landing/` so the proxy can serve them without a session. Ciscela (`font-display`, in `globals.css`) is for its headings only, never the dashboard.

- `landing.tsx` sections and header, the light-only hook; `landing.css` its keyframes and scroll reveals
- `scan-demo.tsx` the hero's looping phone demo (holds on the review under reduced motion)
- `scroll-reveal.tsx` the pinned problem paragraph that lights up word by word
- `hand-count.tsx` where a hand count goes wrong, as inline SVG line illustrations
- `how-showcase.tsx` How it works: sticky rows that stack, each with a looping photo panel
- `works-on.tsx` a notched photo panel whose tabs swap the shop photo (`public/landing/works/`) and the card of what Tally found
- `powered.tsx` Muse Spark, SAM 3.1 and Qore Catalog, then you confirm
- `meta-mark.tsx` Meta's symbol (path from Simple Icons); swap in the official file from Meta's brand resources before launch
- `reveal.ts` scroll reveals: mark an element `data-reveal`, stagger it with `delay(ms)`; opacity only under reduced motion

The waitlist has no link yet (PRD Q7): the page says it opens soon and shows no dead button. Re-encode the hero video from a new source with:

```sh
ffmpeg -i source.mov -an -vf "scale=1280:-2,fps=25" -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 27 -preset slow -movflags +faststart public/landing/hero/shop.mp4
```
