# Meta hackathon — Tally checklist

The single checklist for the hackathon. Tick items in the same PR that finishes them.

Legend: `[x]` done · `[ ]` to do · **(you)** needs action outside the repo · **(decision)** needs a call before the work starts

**Submission: Tuesday 3 Nov 2026.** Today is Tue 27 Oct, so there are 7 days left.

## End goal

A Nigerian merchant signs in to Tally and says what kind of shop they run. Tally then fills their inventory from the **Qore Catalog**. It does this in two ways: it offers ready-made product templates for that kind of shop, and it matches photos of shelves and labels to real catalogue products, with indicative Naira prices. The merchant accepts or corrects each match. They can then sell from that stock on the web POS and the mobile app. Every accept or correction goes back to Qore Catalog as feedback, so the catalogue improves. That feedback also produces the match-rate numbers for the write-up (`GET /v1/feedback/stats`).

**Demo story, about 3 minutes:**

1. Sign in.
2. Pick a business type, e.g. supermarket.
3. Receive a starter inventory from the templates.
4. Photograph a shelf, and the products are recognised.
5. Confirm or fix them.
6. Ring up a sale.
7. Show the stock going down and the match-rate stats.

## Decisions — blocking

- [ ] **(decision)** **Meta's rules and deliverables.**
  - Is a Llama model required?
  - Do we need a demo video, and how long can it be?
  - What format is the write-up?
  - Does the repo need to be public, and is there a licence requirement?
  - Copy the official rules into this section.
- [ ] **(decision)** **Which model reads the photos.** It turns a shelf or label photo into `{brand, name, pack}` items for `POST /v1/match`. If Meta requires Llama, use a Llama 4 vision model; otherwise pick by cost and speed. Also decide where it runs: `apps/api` calling a hosted API, or `services/train`.
- [ ] **(decision)** **Q Vision console and distillation: in or out of the submission?** Recommendation: **out**. Ship the photo flow on a hosted vision model, and present distillation (`apps/console` + `services/train`) as the next step, using the feedback data collected during the hackathon.
- [ ] **(decision)** **Which surface leads the demo.** Recommendation: **mp (web)** for onboarding and setting up inventory, and **mobile** for taking the photo and making the sale.
- [ ] **(decision)** **Which business types to support.** Recommendation: supermarket and pharmacy. They have the best template coverage in the catalogue (35 of 37 and 28 of 38 items get product suggestions).

## Done

- [x] Monorepo with mp, console, api, mobile, train and the shared packages. Docs with C4 diagrams, flows and a guide for each app. CI that type-checks and builds every app, runs the tests, and scans for secrets.
- [x] Sign-in with Qorelly accounts on every surface: NextAuth over Supabase on web, `supabase_flutter` on mobile, and the API's JWT guard.
- [x] `@tally/catalog-client` covers all of Qore Catalog v1: health, search, product lookup, match, business taxonomy, templates, brands, categories, feedback, stats and key info. Typed and tested.
- [x] Mobile app for Android and iOS, with `dev`, `staging` and `prod` builds.
- [x] `tally` database schema and its Drizzle migration setup (no tables yet).
- [x] Commit guard against secrets: a pre-commit hook plus a CI job.

## Day 1–2 (27–28 Oct): platform

- [ ] **(you)** Deploy Qore Catalog to staging (qore-catalog `docs/planning/2026-10-27-b1-staging-runbook.md`). Then issue Tally's key and the hackathon access code.
- [ ] **(you)** Supabase staging values for Tally: `SUPABASE_URL`, the anon/publishable key and the JWT secret, plus a `SUPABASE_DB_URL` that can create the `tally` schema.
- [ ] Apply migration `0000_tally_setup` to staging (`pnpm db:migrate`).
- [ ] **(decision → db)** Tables in `tally`. A first proposal, to be reviewed before generating migrations:
  - `businesses`: owner `auth.users` id, name, subtype code
  - `business_members`
  - `inventory_items`: business, `core_qid` (nullable), name, pack, unit price in ₦, cost
  - `stock_movements`
  - `sales`, `sale_items`
  - `sale_payments`, which holds the paid amount that all reporting reads from
- [ ] Generate and apply those migrations on staging. Grants go in a separate migration from any tightening of permissions.
- [ ] **(you)** Coolify apps: deploy `apps/api`, `apps/mp`, and `apps/console` if it's in scope, each with its own environment variables. `QORE_CATALOG_API_KEY` is set only on the server side.
- [ ] Docs: add the deployment guide (`docs/guides/deploy.md`), and add the new tables to `architecture/database.md`.

## Day 2–3 (28–29 Oct): onboarding and starter inventory

- [ ] API: create a business, which picks its type from `GET /v1/business-taxonomy`.
- [ ] API: starter inventory from `subtypeTemplates(code, suggestions)`. The merchant ticks items, and these become `inventory_items` linked to their catalogue product (`qid`).
- [ ] mp: onboarding flow: business name → business type → template items (each with its suggested product and price) → confirm.
- [ ] Feedback: each template item kept, swapped or removed is sent as `source: "template"` feedback via `sendFeedback` (idempotent per `clientRef`).
- [ ] Docs: sequence diagram + `architecture/onboarding.md`; take merchant sign-in off "planned" in the merchant journey.

## Day 3–4 (29–30 Oct): photo → match

- [ ] API `POST /photos/match`: image → vision model → `{brand, name, pack}` items → `catalog.match()` → candidates with price.
- [ ] mp + mobile: take or upload a photo → list of matches → for each, accept, pick another candidate, add as a new item, or remove it.
- [ ] Each confirmed result becomes an `inventory_items` row and is sent as `source: "photo"` feedback.
- [ ] Handle partial failure: products the model couldn't identify are added by hand (`new_item`).
- [ ] Docs: the photo pipeline diagram (the planned Q Vision flow becomes built, or gets narrowed).

## Day 4–5 (30–31 Oct): sell

- [ ] API: record a sale, with its line items, a payment and stock deductions, all in one transaction.
- [ ] mp POS: search inventory → basket → take payment (cash/transfer recorded, not processed) → receipt.
- [ ] mobile: the same sale flow (inventory list, basket, record the payment).
- [ ] Stock levels: the inventory list shows current stock from `stock_movements`.
- [ ] Sales summary: reads only from `sale_payments`, never from sale totals.

## Day 6 (1 Nov): numbers and polish

- [ ] Stats page (console or mp admin): `GET /v1/feedback/stats`, showing first-pass match rate, catalogue match rate, suggestion rate, and counts by outcome.
- [ ] Seed a realistic demo business: 2 businesses, about 40 items, a few days of sales.
- [ ] Empty, loading and error states on every demo screen. Design rules: rounded-full buttons, no shadows, Solar icons.
- [ ] Test the full flow end to end on staging, with screenshots of each step.

## Day 7 (2 Nov): submission

- [ ] Demo video, recorded on staging and following the demo story above.
- [ ] Write-up covering:
  - the problem: Nigerian SMEs doing inventory by hand
  - how Tally and Qore Catalog solve it
  - the architecture (the C4 diagrams)
  - the model used for photos
  - real match-rate numbers from `feedback/stats`
  - what comes next: Q Vision distillation trained on the feedback
- [ ] README: product summary at the top, screenshots, a live link, and how to try it (hackathon access code).
- [ ] **(you)** Release: PR `staging` → `main`. Production is applied by the CTO.
- [ ] **(you)** Submit before the deadline, and record the time and submission link here.

## Risks

| Risk | Mitigation |
|---|---|
| Qore Catalog staging isn't up by day 2 | Point Tally's staging at a temporary tunnel to the local catalogue, using a **new** key (never the leaked one). Demo from there. |
| The vision model misreads labels | Use a constrained JSON output, then put every result through `match`; show the low-confidence ones for confirmation. |
| Rate limit of 120 requests/min per key | Batch matches (up to 50 items per call) and cache template responses. |
| Running out of time | Cut, in this order: console stats page → mobile POS → mobile photo. Keep mp onboarding + photo + POS. |

## After the hackathon

Q Vision distillation (console + train, trained on the collected feedback), Qorelly integration (qore-catalog D-3), release signing for mobile, offline sync.
