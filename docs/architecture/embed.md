# Embedded stock-take

A partner app ("client") that a merchant has connected through OAuth can show Tally's stock-take inside its own site as an iframe: upload a shelf photo, the agent counts, the merchant reviews and confirms. It is the same stock-take UI as mp's `/stocktake`, served by apps/mp at `/embed/stocktake`.

The launcher script that mounts the frame (`@qorelly/tally-embed`) and the API side (embed session tokens, `GET /clients/v1/embed-config`, plan limits) are separate pieces; this page covers the frame.

## The flow

1. The client's server exchanges its access token for an embed session token (`POST /api/clients/v1/sessions`, needs `stocktake:write`). It lives 15 minutes.
2. The launcher frames `https://<EMBED_HOST>/embed/stocktake?client_id=<tc_…>&instance=<id>&mode=inline|modal&parent_origin=<origin>`.
3. `proxy.ts` looks the client up (`GET /api/clients/v1/embed-config`, kept 60 s), sets `Content-Security-Policy: frame-ancestors <allowed_origins>` on the response and hands the result to the page in a request header. Pages can't set response headers, so the lookup lives in the proxy and the page never repeats it.
4. The page checks that the client is active and that `parent_origin` is one of its `allowed_origins`. If not, it shows a static error in the frame and posts `error` to `parent_origin`.
5. The frame posts `ready`. The launcher answers `init` with the token, an optional theme and the mode. The token is held in memory only, never in storage or the URL.
6. The stock-take runs in the browser. The frame calls Tally's API directly with `Authorization: Bearer <session token>` (the API's `CORS_ORIGINS` must include `https://<EMBED_HOST>`). It emits events as the flow moves, and the launcher passes them to the client.

## One UI, two data layers

The stock-take components in `apps/mp/app/stocktake/` don't import server actions. They read two contexts from `app/stocktake/api-context.tsx`:

| Context | mp (`/stocktake`) | Embed (`/embed/stocktake`) |
|---|---|---|
| `useStocktakeApi()`: start, poll, quick scan, photo check, reopen, rerun, discard, confirm, catalogue search | the server actions in `actions.ts`, unchanged, with the NextAuth session | `lib/embed-api.ts`: browser `fetch` with the embed token, the same `ActionResult` shapes and messages |
| `useStocktakeNav()`: open a session, start over, refresh, History, Done | URLs: `/stocktake/history/<id>?business=` | views swapped in place inside the frame; no History; Done posts `close` |

`lib/embed-api.ts` adds what only the embed needs:
- A 401 `token_expired` asks the launcher for a fresh token once (`token_request`), then retries once.
- A 401 `grant_revoked` ends the session. The frame shows "Tally access was removed" and posts `error`.
- A 429 from the plan limits returns a typed `limit` (`plan_limit`, `client_cap` or `concurrent_runs`, plus `retry_after_seconds`). The frame shows an inline notice, with Upgrade opening mp's `/settings/plan` in a new tab, and emits `limit.reached`.

### What the scopes allow

| Feature | Needs | Without it |
|---|---|---|
| Quick scan, photo check, review, confirm, discard, catalogue search | `stocktake:write` (required for any embed token) | — |
| Agent stock-take, Rerun | `stocktake:read` too: the run is polled with `GET …/stocktakes/:runId` | Only Quick scan is offered. Its review is kept in memory from the scan's own response. |
| The business's name in headings | `inventory:read` (`GET /businesses/:id`) | "your business" |
| History, recents, business switcher, identify | not offered in the embed | — |

## postMessage protocol v1

Every message is `{ source: "tally-embed", v: 1, instance, type, payload }`. The frame accepts a message only from `window.parent` at `parent_origin` with a matching `instance`, and posts only to `parent_origin` (never `*`). Unknown types are ignored.

| Direction | type | payload |
|---|---|---|
| frame → host | `ready` | `{}` |
| host → frame | `init` | `{ token, theme?, mode }` |
| frame → host | `token_request` | `{}`, about 720 s after each token, or after a 401 `token_expired` |
| host → frame | `token` | `{ token }` |
| host → frame | `theme` | `{ theme }` |
| frame → host | `resize` | `{ height }`, inline mode, whenever the content height changes |
| frame → host | `event` | `{ name, data }` |
| frame → host | `error` | `{ code, message }`: `grant_revoked`, `token_expired`, `origin_not_allowed`, `network`, `unknown` |
| frame → host | `close` | `{}`: the outcome's Done, or the close button in modal mode |

Events:
- `photo.uploaded` `{}`: a run or quick scan accepted the photo.
- `stocktake.started` `{ runId }`: an agent run or a rerun started.
- `stocktake.review` `{ scanId }`: results are ready to review (once per scan).
- `stocktake.confirmed` `{ scanId, runId, created, restocked, restored, skipped }`: `runId` is null for a quick scan.
- `limit.reached` `{ code }`.

Theme `{ primary?, primaryForeground?, primaryInk?, colorScheme?, radius? }`: colours must be `#rrggbb` and the radius 0–24 px. Anything else is dropped. They set `--color-primary`, `--color-primary-foreground`, `--color-primary-ink` and `--radius-xl` (buttons) on `<html>`. `colorScheme` toggles `.dark`, and `auto` follows the frame's `prefers-color-scheme`.

## Hosts

`EMBED_HOST` (for example `embed.tally.qorelly.com`) is an alias of the mp deployment. `proxy.ts` gates on the request's Host header:
- On `EMBED_HOST`: only `/embed/*`, Next's static assets and the icons are served. Everything else is a 404, and NextAuth never runs.
- On any other host: `/embed/*` is a 404.
- With `EMBED_HOST` unset (dev and preview deploys), `/embed/*` is served on the main host so it can be tested.

## Testing it

`/embed/harness` frames `/embed/stocktake` and plays the launcher's side of the protocol, logging every message. It is served in dev and on preview deploys only, never in production. It can use a pasted session token or the fixture client `tc_fixture00000000000000000`. The fixture client also exists only in dev and on previews, and it allows the harness's own origin. With the fixture client, a token carrying a `mock` claim uses fixture data instead of the API (scenarios: ok, grant revoked, limit reached), so the whole flow can be walked before the API side is deployed.
