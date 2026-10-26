# Keeping docs current

Docs are part of the change, not a follow-up. A PR is not ready if it changes behaviour the docs describe and leaves them stale.

## What to update when

| You changed… | Update |
|---|---|
| A new app, service, package or external dependency | Root `README.md` table, `c4-container.mmd`, and `c4-context.mmd` if it is external |
| Auth, sessions, guards, roles | `architecture/auth.md` + the auth sequence diagrams |
| Schema / migrations | `architecture/database.md` if a rule or layout changed; `database-isolation.mmd` if schemas/ledgers changed |
| Catalog endpoints used | `architecture/catalog.md` "Current surface" |
| Mobile structure or conventions | `architecture/mobile.md`, `mobile-clean-architecture.mmd` |
| A user-facing flow ships | Flip it from planned to built in `system-flowchart.mmd` / journeys; add a sequence diagram + `architecture/<flow>.md` for anything with more than three hops |
| Env vars | `.env.example` + the table in `guides/local-development.md` |
| Commands / ports | Root `README.md` "Common commands" + local-development guide |

## Diagrams

Source of truth is `docs/diagrams/mermaid/*.mmd`. Re-render after every edit and commit both:

```bash
pnpm docs:diagrams              # all
pnpm docs:diagrams auth-web-sequence
```

Style: reuse the classDefs from existing diagrams (person, container, external, planned, boundary). Built = solid, planned = dashed. Label edges with protocol/auth in brackets, C4-style.
