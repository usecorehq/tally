import {
  DEFAULT_EMBED_ORIGIN,
  envelope,
  isEnvelope,
  randomId,
  sanitizeTheme,
} from "./protocol";
import type { EmbedController, MountOptions, Theme } from "./types";

export type Listen = (target: EventTarget, type: string, handler: (event: Event) => void) => void;

export type Strategy = {
  show(): void;
  hide(): void;
  resize(height: number): void;
  teardown(): void;
};

export type StrategyFactory = (
  iframe: HTMLIFrameElement,
  options: MountOptions,
  listen: Listen,
  requestClose: () => void,
) => Strategy;

export function createEmbed(options: MountOptions, strategyFactory: StrategyFactory): EmbedController {
  if (!options.clientId) throw new Error("TallyEmbed: clientId is required");
  if (typeof options.getSessionToken !== "function") {
    throw new Error("TallyEmbed: getSessionToken is required");
  }

  const embedOrigin = new URL(options.embedOrigin ?? DEFAULT_EMBED_ORIGIN).origin;
  const mode = options.mode ?? "inline";
  const instance = randomId();
  let theme: Theme = sanitizeTheme(options.theme);
  let ready = false;
  let destroyed = false;

  const removers: Array<() => void> = [];
  const listen: Listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    removers.push(() => target.removeEventListener(type, handler));
  };

  const params = new URLSearchParams({
    client_id: options.clientId,
    instance,
    mode,
    parent_origin: window.location.origin,
  });
  const iframe = document.createElement("iframe");
  iframe.src = `${embedOrigin}/embed/stocktake?${params.toString()}`;
  iframe.title = "Tally stock-take";
  iframe.allow = "camera";
  Object.assign(iframe.style, { border: "0", display: "block", width: "100%" });

  const post = (type: string, payload: Record<string, unknown>) => {
    if (destroyed) return;
    iframe.contentWindow?.postMessage(envelope(instance, type, payload), embedOrigin);
  };

  const reportError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    options.onError?.({ code: "unknown", message });
  };

  const withToken = (send: (token: string) => void) => {
    Promise.resolve()
      .then(() => options.getSessionToken())
      .then((token) => {
        if (typeof token !== "string" || !token) throw new Error("getSessionToken returned no token");
        send(token);
      })
      .catch(reportError);
  };

  const strategy = strategyFactory(iframe, options, listen, () => {
    strategy.hide();
    options.onClose?.();
  });

  listen(window, "message", (event) => {
    const e = event as MessageEvent;
    if (e.origin !== embedOrigin || e.source !== iframe.contentWindow) return;
    if (!isEnvelope(e.data, instance)) return;
    const payload = e.data.payload ?? {};

    switch (e.data.type) {
      case "ready":
        ready = true;
        withToken((token) => post("init", { token, theme, mode }));
        break;
      case "token_request":
        if (ready) withToken((token) => post("token", { token }));
        break;
      case "resize":
        if (typeof payload.height === "number" && Number.isFinite(payload.height)) {
          strategy.resize(payload.height);
        }
        break;
      case "event":
        if (typeof payload.name === "string") {
          options.onEvent?.({ name: payload.name, data: payload.data });
        }
        break;
      case "error":
        if (typeof payload.code === "string") {
          options.onError?.({
            code: payload.code,
            message: typeof payload.message === "string" ? payload.message : "",
          });
        }
        break;
      case "close":
        strategy.hide();
        options.onClose?.();
        break;
    }
  });

  return {
    iframe,
    open: () => {
      if (!destroyed) strategy.show();
    },
    close: () => {
      if (!destroyed) strategy.hide();
    },
    setTheme: (next) => {
      theme = sanitizeTheme(next);
      if (ready) post("theme", { theme });
    },
    destroy: () => {
      if (destroyed) return;
      strategy.hide();
      destroyed = true;
      for (const remove of removers.splice(0)) remove();
      strategy.teardown();
    },
  };
}
