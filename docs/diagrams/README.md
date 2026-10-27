# Architecture diagrams

Visual companion to [`docs/architecture/`](../architecture/). Each diagram is [Mermaid](https://mermaid.js.org/) source in [`mermaid/`](mermaid/), rendered to SVG in [`images/`](images/). GitHub renders the `.mmd` source too.

**Legend:** solid blue = built; dashed blue outline = planned; grey = external system; dark blue = person.

## C4 model

| Diagram | Description |
|---|---|
| [`c4-context.svg`](images/c4-context.svg) ([source](mermaid/c4-context.mmd)) | System context — merchants and Q Vision operators, Tally, the shared Qorelly Supabase and the Qore Catalog API. |
| [`c4-container.svg`](images/c4-container.svg) ([source](mermaid/c4-container.mmd)) | Containers — mp, console, mobile, api, train, Postgres (`tally` schema) and how they authenticate and talk. |

## System overview

| Diagram | Description |
|---|---|
| [`system-flowchart.svg`](images/system-flowchart.svg) ([source](mermaid/system-flowchart.mmd)) | Merchant flow (sign in → onboard → inventory → POS) and Q Vision flow (upload → match → train → ship). Marks what is built vs planned. |

## Auth

See [`architecture/auth.md`](../architecture/auth.md).

| Diagram | Description |
|---|---|
| [`auth-web-sequence.svg`](images/auth-web-sequence.svg) ([source](mermaid/auth-web-sequence.mmd)) | mp / console: proxy redirect → NextAuth Credentials → Supabase → JWT cookie → token refresh → Bearer call to the API. |
| [`auth-mobile-sequence.svg`](images/auth-mobile-sequence.svg) ([source](mermaid/auth-mobile-sequence.mmd)) | Mobile: AuthBloc session restore, SignInCubit → use case → repository → Supabase, Dio bearer interceptor. |

## Database

See [`architecture/database.md`](../architecture/database.md) and [`guides/database-migrations.md`](../guides/database-migrations.md).

| Diagram | Description |
|---|---|
| [`database-isolation.svg`](images/database-isolation.svg) ([source](mermaid/database-isolation.mmd)) | Schemas in the shared Qorelly database, which repo migrates which, and where each ledger lives. |
| [`migration-flow.svg`](images/migration-flow.svg) ([source](mermaid/migration-flow.mmd)) | schema.ts → generate → review → PR → staging → frozen → CTO applies production. |

## Mobile

| Diagram | Description |
|---|---|
| [`mobile-clean-architecture.svg`](images/mobile-clean-architecture.svg) ([source](mermaid/mobile-clean-architecture.mmd)) | presentation → domain ← data, with get_it wiring. |

## Q Vision (planned)

| Diagram | Description |
|---|---|
| [`qvision-distillation-flow.svg`](images/qvision-distillation-flow.svg) ([source](mermaid/qvision-distillation-flow.mmd)) | Upload → link to catalog products → training run → model artifact. Not built; open questions in the prose doc. |

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
