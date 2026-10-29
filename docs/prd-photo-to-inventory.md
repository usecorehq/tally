# PRD — Tally Photo-to-Inventory (powered by Meta Muse)

| | |
| --- | --- |
| Product | Tally (sister product to Qorelly) |
| Owner | Core Technologies LTD |
| Status | Draft v0.4 — 2026-10-28 (aligned with [vision-recognition.md](architecture/vision-recognition.md)) |
| Context | Hackathon build on Meta Muse Spark (Meta Model API) |
| Surfaces | `apps/mobile` (Flutter, `qore_tally`), `apps/api` (NestJS), `apps/landing` (Vite) |

> **Status: planned.** Nothing in this PRD is built yet except what §0 lists as existing.
>
> **This PRD is the product side** (who, why, screens, metrics, slices). The technical design —
> models, routes, tables, errors — is [Vision recognition](architecture/vision-recognition.md).
> Where they differ, that doc wins; change it first, then this one.

---

## 0. What already exists (staging, 2026-10-28)

Photo-to-inventory builds on these; it does not replace them.

| Area | Built | Doc |
| --- | --- | --- |
| Businesses | `tally.businesses` + `business_members` (owner/staff). A merchant is a business; the caller's membership scopes every route. | [onboarding.md](architecture/onboarding.md) |
| Inventory | `tally.inventory_items` — `core_qid` (Qore ID, nullable), `price` (selling price, required), `quantity_on_hand` (trigger-maintained, never written directly), `reorder_point`, `source in ('template','photo','manual')` | [database.md](architecture/database.md) |
| Stock | `tally.stock_movements` — append-only, `type in ('opening','restock','sale','adjustment','void')`, idempotent by `client_movement_id` | [database.md](architecture/database.md) |
| Onboarding API | Starter inventory from Qore Catalog templates, with catalogue feedback per decision (best-effort, retry-safe by `clientRef`) | [onboarding.md](architecture/onboarding.md) |
| Catalog API | `GET /api/catalog/verticals`, `…/subtypes/:code/templates`, `…/products`, `…/products/:qid` — the key stays in `apps/api` | [catalog.md](architecture/catalog.md) |
| Barcode scan | API lookup/link + mobile scanner with on-device inventory cache | [barcode-scan.md](architecture/barcode-scan.md) |
| Mobile | Flavors `dev`/`staging`/`prod`, auth, business picker, barcode scanner; Design 1.5 kit, three-tab shell, Inventory tab (this branch) | [mobile.md](architecture/mobile.md) |
| Vision design | Shelf scan + point to sell on Muse Spark 1.3 and SAM 3.1 — *planned* | [vision-recognition.md](architecture/vision-recognition.md) |

## 1. Problem

Nigerian SME merchants (provision stores, supermarkets, pharmacies, mini-marts) count stock by hand.
A stock take of a single shelf means reading every label, tallying on paper, then typing it into a
spreadsheet or POS. It is slow, so it happens rarely, so stock-on-hand drifts from reality, so
merchants run out of fast movers and over-order slow ones.

Barcode scanning helps but still means touching every unit, and a large share of local stock
(loose goods, repackaged items, unlabeled cartons) has no usable barcode.

## 2. Solution

**Take a photo of a shelf, get an inventory.**

1. The merchant photographs a shelf, crate or pile of stock.
2. **Muse Spark** reads the whole frame: every distinct product, with brand, name, pack size, a rough count and a box.
3. **SAM 3.1** counts and outlines the instances of each product (Muse's count is the fallback).
4. **Qore Catalog** `POST /v1/match` matches each product to a Qore ID, with an indicative ₦ price.
5. The merchant accepts, corrects, adds as their own item, or removes each detection, sets quantity and price, and confirms.
6. New products become inventory items with opening stock; products already stocked get a restock.
   Every decision goes back to Qore Catalog as feedback.

Two more ways the models earn their place:

- **Point to sell** — at the till, point the camera at one item. Barcode first; if there is none,
  Muse Spark picks the item from the merchant's own inventory. Always a suggestion the merchant taps.
- **Ask your stock** — plain-language questions (*"which drinks are below 10?"*) answered by Muse
  from the merchant's inventory (§6.3, an addition to the vision design).

### Why Meta's models

Muse Spark (Meta Model API) reads images, returns structured JSON and calls tools, with a
`reasoning_effort` control. SAM 3.1 segments and counts instances of a named product far better
than a language model counts. Together they cover seeing, counting, matching and conversing; we use
them as much as possible (§6).

## 3. Goals and non-goals

### Goals (hackathon MVP)
- G1. Photo → counted, catalog-matched item list in under 30 seconds for a typical shelf photo.
- G2. Review-and-confirm flow that writes stock-on-hand and an auditable stock movement.
- G3. Inventory list (default view) with natural-language search via Muse.
- G4. Built on the Qorelly mobile Design V2 system (Design 1.5 kit) so it reads as a Qorelly product.
- G5. A simple landing page explaining the product with a call to action.

### Non-goals (MVP)
- Sales / POS, orders, invoices, payments, revenue reporting. (Nothing in this PRD reads or writes money.)
- Purchase orders, suppliers, multi-location transfers.
- Offline scanning (photos need the network to reach Muse).
- On-device inference. (Q Vision distillation is a later phase — §6.)
- Web merchant portal (`apps/mp`) inventory screens.

## 4. Users

| Persona | Need |
| --- | --- |
| **Owner-operator** (primary) | Knows the stock by eye, hates the paperwork. Wants a number fast and to trust it. |
| **Shop attendant** | Does the counting at close. Needs a flow that a non-technical person can finish without help. |
| **Hackathon judge** | Needs to see the model doing real work on a real Nigerian shelf in under two minutes. |

## 5. User stories

1. As an owner, I open Tally and land on Inventory: a capture card at the top, my stock list below.
2. As an attendant, I tap **Scan shelf**, take (or pick) a photo, and see a processing state.
3. I see a review list: each detected product with photo crop or catalog image, matched catalog name,
   count, and a confidence pill. Low-confidence rows are flagged.
4. I change a count with a stepper, or tap a row to swap its match by searching the catalog.
5. I mark a row as "not mine / ignore".
6. I tap **Add to inventory** (new scan) or **Update counts** (recount) and the list updates.
7. I type or say *"what's running low?"* in the search bar and get matching items plus a one-line answer.
8. I open an item and see its current count, its last scans, and its movement history.
9. As a visitor, I land on the website, understand the product in one screen, and join the waitlist / get the app.

## 6. How the models are used

Summary only — the design, prompts order and API are in
[vision-recognition.md](architecture/vision-recognition.md).

| Step | Model | Notes |
| --- | --- | --- |
| Read the shelf | Muse Spark `muse-spark-1.3` | One call per photo; structured JSON `{brand, name, pack, count, box}`, box on a 0–1000 grid |
| Count + outline | SAM 3.1 `sam-3.1` | One concept prompt per product, in parallel; boxes drive the confirm overlay |
| Match | Qore Catalog `POST /v1/match` | All products in one call; top 3 candidates each; same Qore ID already stocked → restock |
| Point to sell | Muse Spark, minimal reasoning | Closed set: the merchant's inventory leads the prompt (prompt cache); after barcode, before an on-device model |
| Ask your stock | Muse Spark, tool calling | §6.3 — not yet in the vision design |
| Later: on-device | Q Vision student | Distilled from Muse labels + merchant confirmations ([qvision-distillation.md](architecture/qvision-distillation.md)) |

All model calls go through `apps/api`; `META_MODEL_API_KEY` is server-only and requests use Meta's
Standard mode, so merchants' photos are not used to train Meta's models.

### 6.1 Feedback loop to Qore Catalog
- Every confirm decision goes to `POST /v1/feedback` with `source: "photo"`, keyed by detection id —
  the same best-effort, retry-safe pattern as onboarding: a catalogue outage never fails the confirm.
- `GET /v1/feedback/stats` gives our match rate — a live demo metric (§10).
- Feedback from access-code keys does not create catalogue search aliases; fine for the hackathon.

### 6.2 Point to sell (latency tiers)
Barcode from the cached inventory (< 100 ms, built) → `identify` with one 640 px frame once the frame
is steady and no barcode has been read for ~600 ms → on-device model (planned). A recognised item is
never added to a sale without the merchant's tap. Selling itself (POS) is out of scope here.

### 6.3 Ask your stock (addition — to be added to the vision design before it is built)
- Muse gets read-only tools over the merchant's own inventory: `list_inventory(filter)`,
  `get_item(id)`, `get_movements(item_id, since)`, scoped server-side to the caller's business.
- It returns `{answer, item_ids[]}`; the app shows the one-line answer plus rows from our DB, never
  model-written numbers. Minimal reasoning (latency matters). Proposed route
  `POST /api/businesses/:id/inventory/ask` (Q11).

### 6.4 Stretch
- **Count mode** (Q9): a scan that sets on-hand to what the photo shows (an `adjustment`) instead of
  adding to it (`restock`), with a short Muse summary of the differences.
- **Voice**: hold-to-talk on Ask your stock; audio to Muse in the same call.

### 6.5 Guardrails
- Model output is schema-validated; models never write to the database; only the merchant's confirm writes stock.
- Counts and matches are suggestions until confirmed; the confirm screen says so.
- Each scan records model ids and time per stage (`vision_scans`) for cost and accuracy tracking.

## 6A. Qore Catalog (where inventory items come from)

Every inventory item that exists in the catalog is keyed by its permanent **Qore ID** (`qid`,
e.g. `QC-XXXX-XXXX-X`). Tally stores the `qid`, not a copy of the product record.

- Base URL: `https://api.qorecatalogue.com` · OpenAPI: `/docs-json` · Swagger UI: `/docs`
- Auth: `x-api-key` header, **server-only** (already the pattern in `packages/catalog-client`).
- Hackathon key: `POST /v1/keys` with an access code (`{code, name, email}`) → key shown once,
  scopes + expiry from the code; `GET /v1/keys/me` checks it.
- "Standard records for products sold in Nigeria … Prices are indicative shelf prices."

| Endpoint | Use in Tally |
| --- | --- |
| `GET /v1/health` | Health check (already in `catalog-client`) |
| `POST /v1/match` | Batch match Muse's detected items to ranked candidates (§6, Match) |
| `GET /v1/products?q=&brand=&category=&offset=&limit=` | Match picker (S5) via the built `GET /api/catalog/products`. Typo-tolerant. |
| `GET /v1/products/{qid}` | Item detail: product record, indicative price, **sibling pack sizes** (lets the review screen offer "70g → 120g" swaps) |
| `GET /v1/brands`, `GET /v1/categories` | Group and filter the inventory list; NL search filters ("drinks", "grains") map to category paths |
| `GET /v1/business-taxonomy` | Business type/sub-type codes (same codes as Qorelly `business_type` / `business_subtype`) |
| `GET /v1/business-taxonomy/subtypes/{code}/templates` | Onboarding starter inventory (built) |
| `POST /v1/feedback`, `GET /v1/feedback/stats` | Confirm-time feedback and match-rate stats (§6.1) |

Rules:
- Indicative prices are **not revenue** and never feed reporting. MVP does not display them; if a
  later slice shows "estimated stock value", it is labelled as an estimate from indicative prices.
- Response shapes are not in the OpenAPI document (no schemas). Slice 0 records real responses with
  our key before any client code is written.
- Product images: confirm in Slice 0 whether records carry an image URL; if not, S1/S4 use the
  scan crop.

## 7. Mobile app (`apps/mobile`)

### 7.1 Architecture (existing Tally rules)
- Clean architecture per feature: `data/` `domain/` `presentation/`.
- Repositories return `Either<Failure, T>`; DI via get_it in `injection_container.dart`.
- bloc for app-level flows (auth, scan session), cubit for screen-local state.
- Talks only to `apps/api` (Bearer Supabase access token). No direct Muse or Catalog calls.
- Flavors `dev` / `staging` / `prod` as built ([mobile-flavors.md](architecture/mobile-flavors.md)).
- Everything is scoped to the business selected in `BusinessCubit` (as the barcode scanner is).

### 7.2 Design system
- Source: Qorelly mobile Design 1.5 (mobile port of web Design V2) in `qorelly-mobile`:
  `lib/core/design/v15_tokens.dart`, `v15_widgets.dart`, `v15_parts.dart` and spec
  `qorelly-mobile/.git/design-v15/design_v2_spec.md`.
- Tally ports the tokens + needed widgets into `apps/mobile/lib/core/design/` (copied, not
  imported — `qorelly-mobile` uses Riverpod; Tally uses bloc, so widgets must be state-agnostic).
- Key rules carried over: "the number is the content", grey tray + white sheets, colour only for
  meaning, honest states (skeleton → error+retry → empty only after a successful empty read; never
  show `0` from a failed read, show `–`), sentence case, weights 400/500/600, tabular figures,
  44px touch targets, no FABs (header `+` or in-page button), accent purple `#7856FF`.
- Icons: the mobile kit uses Phosphor (outline everywhere, fill for active). **Open question Q4**
  vs the org Solar rule.

### 7.3 Navigation
Bottom tabs: **Inventory** (default) · **Scans** · **Settings**. The existing barcode scanner
opens from the Inventory header (scan-to-find), separate from **Scan shelf** (photo).

### 7.4 Screens

| # | Screen | Contents |
| --- | --- | --- |
| S1 | **Inventory (default)** | Page header "Inventory". Capture card: last scan thumbnail + "Scan shelf" primary button (or empty-state prompt on first run). Muse search field. Summary wells: items tracked, units on hand, low stock (counts only). Inventory list in tray/sheet rows: name, catalog image, count right-aligned tabular, low-stock pill. |
| S2 | **Capture** | Camera view with framing hint, shutter, gallery pick, flash. Tips line ("step back so the whole shelf fits"). |
| S3 | **Processing** | Photo with shimmer/skeleton list; staged copy: "Finding products… Counting… Matching to Qore Catalog…". Cancel. |
| S4 | **Review** (confirm) | Photo with tappable SAM outlines. Rows: match image + name, count stepper, confidence pill (green/amber/red), "Not in catalog" state, "Restock · 18 in stock" for products the business already has. New items need a selling price (`inventory_items.price` is required): prefilled from the catalogue's indicative price, which the merchant confirms or edits. Footer: "Add 6 items · 142 units" primary. Retake action. |
| S5 | **Match picker** (sheet) | Catalog search field prefilled with the detected label, candidate rows, "Add as local item". |
| S6 | **Ask your stock** | Muse one-line answer notice + matching item rows. Suggested prompts when empty. |
| S7 | **Item detail** | Count figure, catalog info, last scans (thumbnails), movement history. Manual adjust. |
| S8 | **Scans** | History of scans with status (draft / confirmed), date, item and unit totals. Open a draft to resume review. |
| S9 | **Settings** | Account, business, sign out. |
| S10 | **Point to sell** | Camera with barcode + identify; the suggested item as a sheet the merchant taps to confirm. Opens from the Inventory header (today: barcode only). |

Every list/figure has skeleton, error+retry and empty states.

## 8. Backend (`apps/api` + `packages/db`)

Routes, request/response shapes, errors (400/413/403/404/503/502/504 with 20 s / 4 s timeouts) and
tables are specified in [vision-recognition.md](architecture/vision-recognition.md#api-planned):

- `POST /api/businesses/:id/vision/shelf-scans` (multipart image ≤ 4 MB, 1600 px JPEG from the app)
- `GET  /api/businesses/:id/vision/shelf-scans/:scanId`
- `POST /api/businesses/:id/vision/shelf-scans/:scanId/confirm` → `{ created, restocked, removed, invalid, feedback }`
- `POST /api/businesses/:id/vision/identify` (≤ 300 KB, 640 px)
- Tables `vision_scans` and `vision_detections` (`tally` schema, composite FKs on `business_id`).

What this PRD adds on top:

| Need | For | Proposal |
| --- | --- | --- |
| Scan history (S8) | Scans tab | `GET /api/businesses/:id/vision/shelf-scans` (list, newest first) |
| Item detail (S7) | Inventory | `GET /api/businesses/:id/inventory/:itemId` with recent movements |
| Ask your stock (S6) | Inventory search | §6.3 |
| Model + thresholds in DB | Org rule: feature config in DB columns, not env | e.g. a `vision_settings` row (model ids, reasoning effort, confidence thresholds); vision doc currently fixes model ids in code |

Reused unchanged: `inventory_items` (`source = 'photo'`), `stock_movements` (`opening` for new,
`restock` for stocked; idempotent by `client_movement_id`). New items need a selling price
(`inventory_items.price` is required) — prefilled from the indicative catalogue price, which the
merchant confirms. Nothing here feeds revenue reporting.

Config and secrets: `META_MODEL_API_KEY` (server-only, new); `QORE_CATALOG_API_KEY` (server-only, built);
`QORE_CATALOG_BASE_URL` on staging = `https://api.qorecatalogue.com`.

## 9. Landing page (`apps/landing`)

- Vite + React + TypeScript + Tailwind, static build, new workspace package.
- Sections: hero ("Snap a shelf. Get your stock count.") with app screenshot/mock, how it works in
  three steps (Snap → Muse counts and matches → Confirm), what it works on (Nigerian shelf photo
  examples), powered by Muse + Qore Catalog, CTA (app download / waitlist), footer (Core Technologies LTD).
- Design: Qorelly Design V2 (as `@tally/ui`): trays and sheets, 12px buttons, Phosphor icons,
  Ciscela serif for marketing headings. Mobile-first, works at 360px.
- Copy rules: no funding claims (grants, credits and prize money are not "funding raised");
  prices, if any, in ₦.
- Waitlist storage: open question Q7. MVP default is a mailto / external form link, no backend.

## 10. Success metrics

| Metric | MVP target |
| --- | --- |
| Photo → review screen latency (p50) | ≤ 20 s |
| Count accuracy on test set (exact count, per product) | ≥ 80% of rows |
| Catalog match accuracy (top-1, products that exist in catalog) | ≥ 85% |
| Rows the user edits before confirming | ≤ 25% |
| NL search: correct item set on test prompts | ≥ 90% |
| Model time per scan stage | from `vision_scans` |
| Point to sell (identify) p50 | measured; target set after Slice 1 |
| Catalog match rate | from `GET /v1/feedback/stats` for our key |

Test set: 20–30 real shelf photos from Nigerian stores with hand-counted ground truth, committed
under `docs/` fixtures (decide in Slice 0).

## 11. Delivery plan (one verifiable slice at a time)

Each slice starts with a read-only audit and stops on contradictions. Testing is on staging.

| Slice | Scope | Done when |
| --- | --- | --- |
| 0 | **Audit**: record real responses of `/v1/match` and `/v1/products/{qid}` with the staging catalogue key; a real Muse Spark 1.3 and SAM 3.1 call from our infra with `META_MODEL_API_KEY`. Read-only. | Written report, open questions answered or escalated |
| 1 | **Vision spike** in `apps/api`: photo in → Muse read → SAM counts, on 5 test photos. Answers the SAM brand-discrimination question. | Output + timings pasted back |
| 2 | **Matching**: `/v1/match` batch; extend `packages/catalog-client`. | Matches reported against hand labels on the test set |
| 3 | **Schema** `vision_scans`, `vision_detections` (+ settings row if agreed) via `schema.ts` → `pnpm db:generate`. Grants in a separate migration. | Migrations applied to staging, DDL shown |
| 4 | **Shelf-scan + confirm endpoints**, incl. feedback on confirm. | Scan → confirm → stock updated, via curl on staging |
| 5 | **Mobile: design kit + tab shell + Inventory tab** — done on `feat/photo-to-inventory`. | Widget tests; device screenshots on staging |
| 6 | **Mobile: capture → processing → confirm (S2–S5)** — built on `feat/photo-to-inventory`: agent and quick scan both offered (default still open); S5 lists the scan's plausible matches, whole-catalogue search not yet. | Screen recording of a real scan on staging |
| 7 | **Point to sell**: `identify` endpoint + S10. | Latency measured on staging, screenshots |
| 8 | **Ask your stock** (§6.3) + S6. | Test prompts pass, screenshots |
| 9 | **Landing page** `apps/landing` (Vite). | Deployed preview + mobile/desktop screenshots |
| 10 | **Demo polish**: scan history (S8), item detail (S7), demo script. | Dry run under 2 minutes |
| 11 | Stretch: count mode, voice (§6.4). | — |

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| **Meta Model API is a US-only public preview** (waitlist for some). Access from Nigeria / our servers may be blocked. | Slice 0 verifies a real call from our staging infra. Calls are server-side only, so only the API host's region matters. |
| Counting dense or occluded shelves is hard; accuracy below target. | High reasoning effort, `image_quality` gate with retake, framing tips, human review is always the final step. |
| Qore Catalog coverage gaps for local products. | "Not in catalog" path + local items; unmatched rows become catalog-gap reports later. |
| Latency of Muse + per-product SAM calls. | SAM runs in parallel; 20 s timeout; staged processing UI. |
| SAM can't tell brands apart. | Count the generic shape and assign instances by overlap with Muse's boxes (vision doc open question). |
| Cost per scan. | 1600 px / ~400 KB uploads; time per stage recorded; tune effort in DB config. |
| Model hallucinating items or numbers in NL answers. | Rows always come from our DB; answer text only summarizes tool results. |

## 13. Open questions

| # | Question | Default if unanswered |
| --- | --- | --- |
| Q1 | Hackathon deadline, judging criteria, and required Muse usage? | Plan assumes ~1–2 weeks |
| Q2 | Who holds `META_MODEL_API_KEY`, and does it include SAM 3.1? | Blocker for Slice 1 |
| Q3 | ~~Qore Catalog search API?~~ Answered: `api.qorecatalogue.com` (§6A). Remaining: response shapes, image URLs, and the hackathon access code for `POST /v1/keys`. | Slice 0 |
| Q4 | Mobile icons: Phosphor (Qorelly mobile Design 1.5) or Solar (org rule, written for web)? | Phosphor on mobile, Solar on web |
| Q5 | ~~Merchant identity?~~ Answered: `tally.businesses` + `business_members` (§0). | — |
| Q6 | Photo storage for Q Vision training: Supabase Storage bucket or a separate object store? | In memory, discarded after the request (vision doc) |
| Q7 | Landing waitlist: link only, or store sign-ups (needs a `tally` table + public insert)? | Link only |
| Q8 | Should confirmed scans sync stock into Qorelly's own inventory, or stay in Tally for the hackathon? | Stay in Tally |
| Q9 | A scan of a product already stocked: restock (adds) or count (sets on-hand)? | Restock, as in the vision doc; count mode is a stretch (§6.4) |
| Q10 | Model ids and thresholds in a DB settings row (org rule) instead of code? | Propose in Slice 3 |
| Q11 | Ask your stock route name and whether it joins the vision doc. | `…/inventory/ask`, added to the vision doc first |

## 14. References

- Vision recognition design: [architecture/vision-recognition.md](architecture/vision-recognition.md)
- Qore Catalog API: <https://api.qorecatalogue.com/docs> (OpenAPI at `/docs-json`)
- Meta Model API / Muse Spark: <https://dev.meta.ai/resources/blog/build-with-muse-spark/>
- Qorelly mobile design kit: `qorelly-mobile/lib/core/design/` and `qorelly-mobile/.git/design-v15/design_v2_spec.md`
- Qorelly mobile inventory feature notes: `qorelly-mobile/doc/features/inventory.md`
- Tally layout and rules: `README.md`, `CLAUDE.md`
