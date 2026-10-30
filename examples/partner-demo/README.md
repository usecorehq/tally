# Demo Shop: a Connect Tally partner example

A deliberately plain partner app that shows the whole Connect Tally flow with [`@qorelly/tally-embed`](../../packages/sdk-web/README.md):

1. **Connect** a merchant's Tally business through OAuth 2.0 (authorization code + PKCE), by redirect or in a popup.
2. **Run a stock-take** in the embedded Tally iframe, themed with the demo's own colour.
3. **Read the result server-side**: on `stocktake.confirmed`, the server fetches the shelf scan with its access token and the page shows the confirmed lines in its own table.
4. **Hit a plan limit**: `limit.reached` shows a banner.
5. **Disconnect**: the server revokes the grant.

It is not styled like Tally on purpose: a partner keeps its own look.

## How it is built

```
server/index.ts   Hono on Node: OAuth (PKCE, state, code exchange, refresh, revoke), embed sessions, the scan read
web/              Vite, vanilla TS: the page (index.html, main.ts) and the popup callback page (callback.html)
Dockerfile        Multi-stage; the runtime image runs dist/server.mjs, which also serves dist/web
```

- The client secret, access token and refresh token never leave the server. Tokens sit in an in-memory map keyed by the session id; a restart disconnects everyone, which is fine for a demo.
- The PKCE verifier, `state` and the connect mode travel in a signed, httpOnly, SameSite=Lax cookie.
- The page only ever gets an embed session token (`POST /api/session`), and the launcher hands it to the iframe over `postMessage`.

| Route | Does |
| --- | --- |
| `GET /connect?mode=redirect\|popup` | New PKCE verifier and `state` into the cookie; returns `{ authorizeUrl }` for `connect()` |
| `GET /callback` | Checks `state`, exchanges the code (Basic auth), stores the tokens. Redirect mode → `/`; popup mode → a page that calls `completeConnect()` |
| `GET /api/me` | `/clients/v1/me` (refreshing the access token when needed), plus the client id and embed origin for `mount()` |
| `POST /api/session` | `/clients/v1/sessions` → `{ sessionToken }` |
| `GET /api/stocktake/:scanId` | The shelf scan, reduced to its confirmed lines |
| `POST /api/disconnect` | `/clients/v1/oauth/revoke`, then clears the session |

## Environment

Copy `.env.example` to `.env`. Everything is server-only.

| Variable | |
| --- | --- |
| `TALLY_API_URL` | Tally API base, including `/api` |
| `TALLY_AUTHORIZE_URL` | The mp origin + `/oauth/authorize` |
| `TALLY_EMBED_ORIGIN` | Where the embed is served (`https://<EMBED_HOST>`) |
| `TALLY_CLIENT_ID` / `TALLY_CLIENT_SECRET` | From registering the client (below) |
| `DEMO_BASE_URL` | This app's own https origin. The redirect URI is `${DEMO_BASE_URL}/callback` |
| `SESSION_SECRET` | At least 32 random characters; signs the cookie |
| `PORT` | Default `4200` (Tally's API uses 4100 and Qore Catalog 3100 on the shared Coolify host) |

## Register the client

Run once by the CTO against the target database. It prints the secret once:

```bash
node --env-file=apps/api/.env apps/api/scripts/oauth-client-create.mjs --name "Demo Shop" --redirect-uri ${DEMO_BASE_URL}/callback --origin ${DEMO_BASE_URL}
```

`--origin` adds the demo to the client's `allowed_origins`, which the embed checks before it renders and uses for `frame-ancestors`.

## Build and run

```bash
pnpm --filter @qorelly/tally-embed build
pnpm --filter @tally/partner-demo build     # vite → dist/web, tsup → dist/server.mjs
pnpm --filter @tally/partner-demo start     # needs the env above
```

## Deploy (Coolify)

- Build pack: Dockerfile, at `examples/partner-demo/Dockerfile`, with the repository root as the build context.
- Port 4200. Set the variables above as runtime env.
- Give it an https domain and use that as `DEMO_BASE_URL`; register the client with the same origin.
