# Keeping docs current

Docs are part of the change, not a follow-up. A PR is not ready if it changes behaviour the docs describe and leaves them stale.

## What to update when

| You changed… | Update |
|---|---|
| A new app, service, package or external dependency | Root `README.md` table, the C4 container image, and the context image if it is external |
| Auth, sessions, guards, roles | `architecture/auth.md` + the auth sequence diagrams |
| Schema / migrations | `architecture/database.md` if a rule or layout changed; the ERD image if tables changed |
| Catalog endpoints used | `architecture/catalog.md` "Current surface" |
| Mobile structure or conventions | `architecture/mobile.md`, the mobile clean-architecture image |
| Mobile flavors, app IDs or mobile env keys | `architecture/mobile-flavors.md`, the mobile flavors image, the flavor table in `apps/mobile/README.md`, `apps/mobile/.env.example` |
| A user-facing flow ships | Update the overview or sequence image that shows it; add a sequence image + `architecture/<flow>.md` for anything with more than three hops |
| Env vars | `.env.example` + the table in `guides/local-development.md` |
| Commands / ports | Root `README.md` "Common commands" + local-development guide |

## Diagrams

Diagrams are maintained as images, not generated from source: the overviews in `docs/diagrams/` (`1.process-reengineering.webp`, `2.stock-take-agent-highlevel.webp`) and the SVGs in `docs/diagrams/images/`. When a change makes one wrong, replace the image in the same PR, or note in the PR that it needs regenerating. Built = solid, planned = dashed.
