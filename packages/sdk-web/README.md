# @qorelly/tally-embed

Browser launcher for Connect Tally. A partner app uses it to:

- **connect** a merchant's Tally business through OAuth 2.0 (authorization code + PKCE), in a popup or by redirect, and
- **mount** Tally's stock-take as an iframe, inline or in a modal, and hear what happens in it.

Plain TypeScript, zero runtime dependencies. Builds to ESM, CJS and an IIFE that sets the global `TallyEmbed` (about 3 KB gzipped).

> **Status:** private workspace package (`"private": true`). It will be published to npm once the `@qorelly` scope is registered. Until then, use it from this monorepo.

## Install

Inside this monorepo:

```json
{ "dependencies": { "@qorelly/tally-embed": "workspace:*" } }
```

Once published (planned):

```bash
npm install @qorelly/tally-embed
```

## Use it

### Script tag

```html
<div id="stocktake"></div>
<script src="/vendor/tally-embed.min.js"></script>
<script>
  const embed = TallyEmbed.mount({
    container: "#stocktake",
    clientId: "tc_…",
    getSessionToken: () => fetch("/api/session", { method: "POST" }).then((r) => r.json()).then((b) => b.sessionToken),
    onEvent: (e) => console.log(e.name, e.data),
  });
</script>
```

Copy `dist/tally-embed.min.js` into your static files for now. A CDN URL (unpkg / jsDelivr) comes with the npm release.

### ESM

```ts
import { connect, completeConnect, mount } from "@qorelly/tally-embed";

const embed = mount({ clientId, getSessionToken, mode: "modal", onClose: () => embed.destroy() });
embed.open();
```

## API

### `mount(options): EmbedController`

Creates one iframe at `<embedOrigin>/embed/stocktake?client_id&instance&mode&parent_origin`. Only those four non-secret fields go in the URL; the session token and theme go over `postMessage`.

| Option | Type | Default | |
| --- | --- | --- | --- |
| `clientId` | `string` | required | Your OAuth client id (`tc_…`). |
| `getSessionToken` | `() => Promise<string>` | required | Returns a fresh embed session token from **your server** (`POST /clients/v1/sessions`). Called when the frame is ready and whenever it asks for a new token (about every 12 minutes, or after a 401). |
| `container` | `string \| HTMLElement` | none | Selector or element for inline mode. Required for inline; ignored for modal. |
| `mode` | `"inline" \| "modal"` | `"inline"` | Inline fills the container's width and follows the frame's content height. Modal is a centred 720 px × 85vh sheet with a backdrop, full screen under 768 px; Escape and the backdrop close it. |
| `embedOrigin` | `string` | `https://embed.tally.qorelly.com` | Where the embed is served. Point it at staging while you build. |
| `theme` | `Theme` | none | See below. |
| `onEvent` | `(e: { name, data }) => void` | none | Events from the stock-take (below). |
| `onError` | `(e: { code, message }) => void` | none | Errors from the frame, plus `unknown` when `getSessionToken` fails. |
| `onClose` | `() => void` | none | The merchant closed it: the frame's close button, Escape, or the backdrop. |

The returned controller:

| Member | |
| --- | --- |
| `open()` | Shows the frame (opens the modal; moves focus into the frame). |
| `close()` | Hides it (focus returns to where it was). Does not call `onClose`. |
| `setTheme(theme)` | Validates and sends a new theme. |
| `destroy()` | Removes the iframe, the overlay and every listener. |
| `iframe` | The `HTMLIFrameElement`. |

### Theme

```ts
type Theme = {
  primary?: string;           // #rrggbb
  primaryForeground?: string; // #rrggbb, text on primary
  primaryInk?: string;        // #rrggbb, primary-coloured text on white
  colorScheme?: "light" | "dark" | "auto";
  radius?: number;            // 0–24
};
```

Anything that does not match is dropped before it is sent, and the frame applies the same rules.

### Events (`onEvent`)

| `name` | `data` |
| --- | --- |
| `photo.uploaded` | |
| `stocktake.started` | `{ runId }` |
| `stocktake.review` | `{ scanId }` |
| `stocktake.confirmed` | `{ scanId, runId, created, restocked, restored, skipped }` |
| `limit.reached` | `{ code }`: `plan_limit`, `client_cap` or `concurrent_runs` |

### Errors (`onError`)

`grant_revoked`, `token_expired`, `origin_not_allowed`, `network`, `unknown`. On `grant_revoked`, treat the business as disconnected and offer Connect again.

### `connect({ authorizeUrl, mode, onResult })`

Sends the merchant to Tally's consent screen. Build `authorizeUrl` on your server (it holds the PKCE verifier and `state`).

- `mode: "redirect"` (default) calls `location.assign(authorizeUrl)`. Your callback route handles the result.
- `mode: "popup"` opens a centred 480 × 640 window. If the popup is blocked, or the viewport is under 768 px, it falls back to redirect. When your callback page calls `completeConnect()`, `onResult({ code?, state?, error? })` runs in the opener.

### `completeConnect()`

Call it on your redirect-URI page when it loads in the popup. It posts the page's query string to `window.opener` on your own origin, then closes the popup. With no opener (redirect mode) it does nothing.

## Message protocol (v1)

Every message is `{ source: "tally-embed", v: 1, instance, type, payload }`. The launcher accepts a message only when `event.origin` is `embedOrigin`, `event.source` is its own iframe, and `source`, `v` and `instance` match; it posts only to `embedOrigin`, never `*`. Unknown types are ignored.

| Direction | `type` | `payload` |
| --- | --- | --- |
| frame → host | `ready` | `{}` |
| host → frame | `init` | `{ token, theme?, mode }` |
| frame → host | `token_request` | `{}` |
| host → frame | `token` | `{ token }` |
| host → frame | `theme` | `{ theme }` |
| frame → host | `resize` | `{ height }` |
| frame → host | `event` | `{ name, data }` |
| frame → host | `error` | `{ code, message }` |
| frame → host | `close` | `{}` |

## Content Security Policy

If your page sends a CSP, allow the embed origin as a frame source:

```
Content-Security-Policy: frame-src https://embed.tally.qorelly.com;
```

When you load the script from a CDN (after the npm release), add that CDN to `script-src`. The embed itself only renders inside origins registered on your client (`allowed_origins`).

## Security notes

- Never put tokens in URLs. The launcher sends the session token only over `postMessage` to `embedOrigin`.
- Mint embed session tokens on your server with your access token. Your client secret, access token and refresh token never reach the browser.
- Session tokens live 15 minutes and sit only in the frame's memory; the frame asks for a new one before expiry.
- Check `state` on your callback before you exchange the code.

## Develop

```bash
pnpm --filter @qorelly/tally-embed build       # dist/: .esm.js, .cjs.js, .min.js (+ maps, .d.ts)
pnpm --filter @qorelly/tally-embed test        # vitest + jsdom
pnpm --filter @qorelly/tally-embed playground  # after build: host on :5180, mock embed on :5181
```

The playground (`playground/`, not part of the build) mounts the built IIFE against a mock embed page on a second port, so the cross-origin checks run as they do in production. Set `HOST_PORT` to move both (the embed takes the next port).
