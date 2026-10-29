# Architecture diagrams

Visual companion to [`docs/architecture/`](../architecture/). Each diagram is [Mermaid](https://mermaid.js.org/) source in [`mermaid/`](mermaid/), rendered to SVG in [`images/`](images/). GitHub renders the `.mmd` source too.

**Legend:** solid blue = built; dashed blue outline = planned; grey = external system; dark blue = person.

## C4 model

| Diagram | Description |
|---|---|
| [`c4-context.svg`](images/c4-context.svg) ([source](mermaid/c4-context.mmd)) | System context — merchants, Tally (POS + inventory, web + mobile), the shared Qorelly Supabase and the Qore Catalog API. |
| [`c4-container.svg`](images/c4-container.svg) ([source](mermaid/c4-container.mmd)) | Containers — mp, mobile, api, Postgres (`tally` schema) and how they authenticate and talk. |

## System overview

| Diagram | Description |
|---|---|
| [`system-flowchart.svg`](images/system-flowchart.svg) ([source](mermaid/system-flowchart.mmd)) | Merchant flow (sign in → onboard → inventory → POS), with recognition training shown as external (Qore Catalog). Marks what is built vs planned. |

## Auth

See [`architecture/auth.md`](../architecture/auth.md).

| Diagram | Description |
|---|---|
| [`auth-web-sequence.svg`](images/auth-web-sequence.svg) ([source](mermaid/auth-web-sequence.mmd)) | mp: proxy redirect → NextAuth Credentials → Supabase → JWT cookie → token refresh → Bearer call to the API. |
| [`auth-mobile-sequence.svg`](images/auth-mobile-sequence.svg) ([source](mermaid/auth-mobile-sequence.mmd)) | Mobile: AuthBloc session restore, SignInCubit → use case → repository → Supabase, Dio bearer interceptor. |

## Onboarding

See [`architecture/onboarding.md`](../architecture/onboarding.md).

| Diagram | Description |
|---|---|
| [`onboarding-sequence.svg`](images/onboarding-sequence.svg) ([source](mermaid/onboarding-sequence.mmd)) | Business creation → template → starter inventory + opening stock → catalogue feedback, including retry safety and best-effort feedback. |

## Vision recognition

See [`architecture/vision-recognition.md`](../architecture/vision-recognition.md).

| Diagram | Description |
|---|---|
| [`vision-shelf-scan-sequence.svg`](images/vision-shelf-scan-sequence.svg) ([source](mermaid/vision-shelf-scan-sequence.mmd)) | Shelf photo → Muse Spark → SAM 3.1 per product → catalogue match → confirm → inventory + photo feedback. |
| [`vision-schema-erd.svg`](images/vision-schema-erd.svg) ([source](mermaid/vision-schema-erd.mmd)) | The vision tables and how they relate: scans, detections, readings, stock-take runs and steps, the two links to inventory items, and the soft links to Qore Catalog, R2 and stock movements. See [`architecture/vision-schema.md`](../architecture/vision-schema.md). |
| [`vision-identify-sequence.svg`](images/vision-identify-sequence.svg) ([source](mermaid/vision-identify-sequence.mmd)) | Point to sell: barcode on device first, then Muse Spark reads the label and Tally matches it to the merchant's items (catalogue only on a miss); confirming remembers the reading. |

## Stock-take agent

See [`architecture/stocktake-agent.md`](../architecture/stocktake-agent.md).

| Diagram | Description |
|---|---|
| [`stocktake-agent-sequence.svg`](images/stocktake-agent-sequence.svg) ([source](mermaid/stocktake-agent-sequence.mmd)) | Async run: first pass, then the Muse Spark tool loop (zoom, catalogue search, SAM count, store check, record), step trace for polling, human confirm. |
| [`stocktake-history-sequence.svg`](images/stocktake-history-sequence.svg) ([source](mermaid/stocktake-history-sequence.mmd)) | Stock-take history and reopening a session: list, stored scan filled back in from Qore Catalog, presigned crops, the photo from the browser. |

## Database

See [`architecture/database.md`](../architecture/database.md) and [`guides/database-migrations.md`](../guides/database-migrations.md).

| Diagram | Description |
|---|---|
| [`tally-erd.svg`](images/tally-erd.svg) ([source](mermaid/tally-erd.mmd)) | The `tally` tables and how they relate: businesses, members, inventory, stock movements, sales, sale items, payments, and the vision tables (in detail in `vision-schema-erd`). Which columns triggers maintain. |
| [`database-isolation.svg`](images/database-isolation.svg) ([source](mermaid/database-isolation.mmd)) | Schemas in the shared Qorelly database, which repo migrates which, and where each ledger lives. |
| [`migration-flow.svg`](images/migration-flow.svg) ([source](mermaid/migration-flow.mmd)) | schema.ts → generate → review → PR → staging → frozen → CTO applies production. |

## Mobile

| Diagram | Description |
|---|---|
| [`mobile-flavors.svg`](images/mobile-flavors.svg) ([source](mermaid/mobile-flavors.mmd)) | One `flutter run --flavor … -t … --dart-define-from-file …` split into native identity (Android productFlavor / iOS scheme → build config → xcconfig) and Dart runtime config (`.env` → FlavorConfig → bootstrap). See [`architecture/mobile-flavors.md`](../architecture/mobile-flavors.md). |
| [`mobile-clean-architecture.svg`](images/mobile-clean-architecture.svg) ([source](mermaid/mobile-clean-architecture.mmd)) | presentation → domain ← data, with get_it wiring. |

## User journeys

| Diagram | Description |
|---|---|
| [`merchant-journey.svg`](images/merchant-journey.svg) ([source](mermaid/merchant-journey.mmd)) | Merchant lifecycle: sign in → onboard → set up stock → sell → review. Only sign-in is built. |

## Regenerating

Edit the `.mmd` source, then:

```sh
pnpm docs:diagrams              # re-renders every diagram
pnpm docs:diagrams c4-container # just one
```

If headless Chromium won't launch, the script already passes `--no-sandbox`.
