# Architecture diagrams

Visual companion to [`docs/architecture/`](../architecture/). Diagrams are images: the two overviews below sit in this folder, and the rest are SVGs in [`images/`](images/). They are maintained as images (there is no diagram source to re-render); replace the file when the system changes.

## Overviews

| Image | Description |
|---|---|
| [`process-reengineering.webp`](process-reengineering.webp) | Stock-taking before and after Tally: the manual count by owner, staff, notebook and inventory app, versus one photo per shelf, the stock-take agent and the merchant's yes. |
| [`stock-take-agent.webp`](stock-take-agent.webp) | How the stock-take agent counts a shelf: first pass (Muse Spark, SAM 3.1, Qore Catalog, store check), the tool loop, merchant review, confirm, and the catalogue learning. |

**Legend** (SVGs): solid blue = built; dashed blue outline = planned; grey = external system; dark blue = person.

## C4 model

| Diagram | Description |
|---|---|
| [`c4-context.svg`](images/c4-context.svg) | System context — merchants, Tally (photo-to-inventory and stock-taking, web + mobile), the shared Qorelly Supabase and the Qore Catalog API. |
| [`c4-container.svg`](images/c4-container.svg) | Containers — mp, mobile, api, Postgres (`tally` schema) and how they authenticate and talk. |

## System overview

| Diagram | Description |
|---|---|
| [`system-flowchart.svg`](images/system-flowchart.svg) | Merchant flow (sign in → onboard → inventory), with recognition training shown as external (Qore Catalog). Marks what is built vs planned. |

## Auth

See [`architecture/auth.md`](../architecture/auth.md).

| Diagram | Description |
|---|---|
| [`auth-web-sequence.svg`](images/auth-web-sequence.svg) | mp: proxy redirect → NextAuth Credentials → Supabase → JWT cookie → token refresh → Bearer call to the API. |
| [`auth-mobile-sequence.svg`](images/auth-mobile-sequence.svg) | Mobile: AuthBloc session restore, SignInCubit → use case → repository → Supabase, Dio bearer interceptor. |

## Onboarding

See [`architecture/onboarding.md`](../architecture/onboarding.md).

| Diagram | Description |
|---|---|
| [`onboarding-sequence.svg`](images/onboarding-sequence.svg) | Business creation → template → starter inventory + opening stock → catalogue feedback, including retry safety and best-effort feedback. |

## Vision recognition

See [`architecture/vision-recognition.md`](../architecture/vision-recognition.md).

| Diagram | Description |
|---|---|
| [`vision-shelf-scan-sequence.svg`](images/vision-shelf-scan-sequence.svg) | Shelf photo → Muse Spark → SAM 3.1 per product → catalogue match → confirm → inventory + photo feedback. |
| [`vision-schema-erd.svg`](images/vision-schema-erd.svg) | The vision tables and how they relate: scans, detections, readings, stock-take runs and steps, the two links to inventory items, and the soft links to Qore Catalog, R2 and stock movements. See [`architecture/vision-schema.md`](../architecture/vision-schema.md). |
| [`vision-identify-sequence.svg`](images/vision-identify-sequence.svg) | Identify one product: barcode on device first, then Muse Spark reads the label and Tally matches it to the merchant's items (catalogue only on a miss); confirming remembers the reading. |

## Stock-take agent

See [`architecture/stocktake-agent.md`](../architecture/stocktake-agent.md).

| Diagram | Description |
|---|---|
| [`stocktake-agent-sequence.svg`](images/stocktake-agent-sequence.svg) | Async run: first pass, then the Muse Spark tool loop (zoom, catalogue search, SAM count, store check, record), step trace for polling, human confirm. |
| [`stocktake-history-sequence.svg`](images/stocktake-history-sequence.svg) | Stock-take history and reopening a session: list, stored scan filled back in from Qore Catalog, presigned crops, the photo from the browser. |

## Database

See [`architecture/database.md`](../architecture/database.md) and [`guides/database-migrations.md`](../guides/database-migrations.md).

| Diagram | Description |
|---|---|
| [`tally-erd.svg`](images/tally-erd.svg) | The `tally` tables and how they relate: businesses, members, inventory, stock movements and the vision tables (in detail in `vision-schema-erd`). Which columns triggers maintain. |
| [`database-isolation.svg`](images/database-isolation.svg) | Schemas in the shared Qorelly database, which repo migrates which, and where each ledger lives. |
| [`migration-flow.svg`](images/migration-flow.svg) | schema.ts → generate → review → PR → staging → frozen → CTO applies production. |

## Mobile

| Diagram | Description |
|---|---|
| [`mobile-flavors.svg`](images/mobile-flavors.svg) | One `flutter run --flavor … -t … --dart-define-from-file …` split into native identity (Android productFlavor / iOS scheme → build config → xcconfig) and Dart runtime config (`.env` → FlavorConfig → bootstrap). See [`architecture/mobile-flavors.md`](../architecture/mobile-flavors.md). |
| [`mobile-clean-architecture.svg`](images/mobile-clean-architecture.svg) | presentation → domain ← data, with get_it wiring. |

## User journeys

| Diagram | Description |
|---|---|
| [`merchant-journey.svg`](images/merchant-journey.svg) | Merchant lifecycle: sign in → onboard → set up stock → review. Only sign-in is built. |
