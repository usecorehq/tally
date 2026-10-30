import { CONNECT_SOURCE, MOBILE_MAX_WIDTH, PROTOCOL_VERSION, isRecord } from "./protocol";
import type { ConnectOptions, ConnectResult } from "./types";

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 640;

export function connect({ authorizeUrl, mode = "redirect", onResult }: ConnectOptions): void {
  if (mode === "redirect" || window.innerWidth <= MOBILE_MAX_WIDTH) {
    window.location.assign(authorizeUrl);
    return;
  }

  const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
  const popup = window.open(
    authorizeUrl,
    "tally-connect",
    `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
  );
  if (!popup) {
    window.location.assign(authorizeUrl);
    return;
  }

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    window.clearInterval(watch);
  };

  function onMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin || event.source !== popup) return;
    const data: unknown = event.data;
    if (!isRecord(data) || data.source !== CONNECT_SOURCE || data.v !== PROTOCOL_VERSION) return;
    if (typeof data.search !== "string") return;
    cleanup();
    onResult?.(parseResult(data.search));
  }

  // Drop the listener if the merchant closes the popup without finishing.
  const watch = window.setInterval(() => {
    if (popup.closed) cleanup();
  }, 500);
  window.addEventListener("message", onMessage);
}

export function completeConnect(): void {
  const opener = window.opener as Window | null;
  if (!opener) return;
  opener.postMessage(
    { source: CONNECT_SOURCE, v: PROTOCOL_VERSION, search: window.location.search },
    window.location.origin,
  );
  window.close();
}

function parseResult(search: string): ConnectResult {
  const params = new URLSearchParams(search);
  const result: ConnectResult = {};
  for (const key of ["code", "state", "error"] as const) {
    const value = params.get(key);
    if (value !== null) result[key] = value;
  }
  return result;
}
