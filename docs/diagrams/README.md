# Architecture diagrams

Visual companion to [`docs/architecture/`](../architecture/). Diagrams are images: the numbered overviews and sequences sit in this folder, and the rest are SVGs in [`images/`](images/). They are maintained as images (there is no diagram source to re-render); replace the file when the system changes.

## Overviews

| Image | Description |
|---|---|
| [`1.process-reengineering.webp`](1.process-reengineering.webp) | Stock-taking before and after Tally: the manual count by owner, staff, notebook and inventory app, versus one photo per shelf, the stock-take agent and the merchant's yes. |
| [`2.stock-take-agent-highlevel.webp`](2.stock-take-agent-highlevel.webp) | How the stock-take agent counts a shelf: first pass (Muse Spark, SAM 3.1, Qore Catalog, store check), the tool loop, merchant review, confirm, and the catalogue learning. |
| [`7.use-cases.webp`](7.use-cases.webp) | Three ways merchants use Tally: embedded in a partner's app (Connect Tally, OAuth with PKCE, iframe; planned), standalone on Tally (built), and inside Qorelly Inventory (planned), all on one API, agent, Qore Catalog and Qorelly account. |

**Legend** (SVGs): solid blue = built; dashed blue outline = planned; grey = external system; dark blue = person.

## C4 model

| Diagram | Description |
|---|---|
| [`c4-context.svg`](images/c4-context.svg) | System context — merchants, Tally (photo-to-inventory and stock-taking, web + mobile), the shared Qorelly Supabase and the Qore Catalog API. |
| [`c4-container.svg`](images/c4-container.svg) | Containers — mp, mobile, api, Postgres (`tally` schema) and how they authenticate and talk. |

## Onboarding

See [`architecture/onboarding.md`](../architecture/onboarding.md).

| Diagram | Description |
|---|---|
| [`onboarding-sequence.svg`](images/onboarding-sequence.svg) | Business creation → template → starter inventory + opening stock → catalogue feedback, including retry safety and best-effort feedback. |

## Vision recognition

See [`architecture/vision-recognition.md`](../architecture/vision-recognition.md).

| Diagram | Description |
|---|---|
| [`6.quick-scan.webp`](6.quick-scan.webp) | Quick scan: shelf photo to stock. Muse Spark reads, then SAM 3.1 counts and Qore Catalog matches in parallel, the store check, save the scan, photo and crops, review, confirm in one transaction, then feedback and crops as training samples. Also the stock-take agent's first pass. |
| [`5.identify-one-product.webp`](5.identify-one-product.webp) | Identify one product in stock: barcode on the device first (tier 0), then Muse Spark reads the label and Tally matches the shop's own items, asking Qore Catalog only on a miss (tier 1); a tap confirms and the reading is remembered. Tier 2 (on-device model) is planned. |

## Stock-take agent

See [`architecture/stocktake-agent.md`](../architecture/stocktake-agent.md).

| Diagram | Description |
|---|---|
| [`3.stock-take-agent-run.webp`](3.stock-take-agent-run.webp) | Stock-take agent, one run step by step: start (202 with a run id), first pass saved as the baseline, the Muse Spark tool loop (zoom up to 30, catalogue search, SAM recount, store check, checked record_line), live trace polled every 1.5 s, the merchant's sign-off. |
| [`4.stock-take-history.webp`](4.stock-take-history.webp) | Stock-take history: list (recents and history by day), reopen any stock-take at its own URL on any device (candidates filled back from Qore Catalog, photo and crops presigned), then rerun, discard or confirm; only one run of a photo is confirmed, the others become superseded. |

## Database

See [`architecture/database.md`](../architecture/database.md) and [`guides/database-migrations.md`](../guides/database-migrations.md).

| Diagram | Description |
|---|---|
| [`tally-erd.svg`](images/tally-erd.svg) | The `tally` tables and how they relate: businesses, members, inventory, stock movements and the vision tables (described in [`architecture/vision-schema.md`](../architecture/vision-schema.md)). Which columns triggers maintain. |
| [`migration-flow.svg`](images/migration-flow.svg) | schema.ts → generate → review → PR → staging → frozen → CTO applies production. |

## Mobile

| Diagram | Description |
|---|---|
| [`mobile-flavors.svg`](images/mobile-flavors.svg) | One `flutter run --flavor … -t … --dart-define-from-file …` split into native identity (Android productFlavor / iOS scheme → build config → xcconfig) and Dart runtime config (`.env` → FlavorConfig → bootstrap). See [`architecture/mobile-flavors.md`](../architecture/mobile-flavors.md). |
| [`mobile-clean-architecture.svg`](images/mobile-clean-architecture.svg) | presentation → domain ← data, with get_it wiring. |
