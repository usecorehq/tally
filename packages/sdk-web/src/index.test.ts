import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeConnect, connect, mount } from "./index";
import { sanitizeTheme } from "./protocol";

const EMBED = "https://embed.example.test";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(mode: "inline" | "modal" = "inline", getSessionToken = vi.fn(async () => "tok-1")) {
  document.body.innerHTML = '<div id="host"></div>';
  const onEvent = vi.fn();
  const onError = vi.fn();
  const onClose = vi.fn();
  const controller = mount({
    container: "#host",
    clientId: "tc_test",
    embedOrigin: EMBED,
    mode,
    getSessionToken,
    onEvent,
    onError,
    onClose,
    theme: { primary: "#0f766e" },
  });
  const frameWindow = controller.iframe.contentWindow!;
  const posted = vi.spyOn(frameWindow, "postMessage").mockImplementation(() => {});
  const instance = new URL(controller.iframe.src).searchParams.get("instance")!;
  const send = (type: string, payload: object = {}, init: Partial<MessageEventInit> = {}) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: "tally-embed", v: 1, instance, type, payload },
        origin: EMBED,
        source: frameWindow,
        ...init,
      }),
    );
  const sentTypes = () => posted.mock.calls.map(([msg]) => (msg as { type: string }).type);
  return { controller, posted, send, sentTypes, instance, onEvent, onError, onClose, getSessionToken };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("mount", () => {
  it("builds the iframe URL with only the non-secret fields", () => {
    const { controller, instance } = setup();
    const url = new URL(controller.iframe.src);
    expect(url.origin + url.pathname).toBe(`${EMBED}/embed/stocktake`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "tc_test",
      instance,
      mode: "inline",
      parent_origin: window.location.origin,
    });
    expect(controller.iframe.allow).toBe("camera");
  });

  it("sends init only after ready, with the token, theme and mode", async () => {
    const { posted, send, getSessionToken } = setup();
    await flush();
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(posted).not.toHaveBeenCalled();

    send("ready");
    await flush();
    expect(posted).toHaveBeenCalledTimes(1);
    const [msg, target] = posted.mock.calls[0]!;
    expect(target).toBe(EMBED);
    expect(msg).toMatchObject({
      source: "tally-embed",
      v: 1,
      type: "init",
      payload: { token: "tok-1", theme: { primary: "#0f766e" }, mode: "inline" },
    });
  });

  it("ignores a spoofed origin", async () => {
    const { posted, send, onEvent } = setup();
    send("ready", {}, { origin: "https://evil.example" });
    send("event", { name: "photo.uploaded" }, { origin: "https://evil.example" });
    await flush();
    expect(posted).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("ignores a message from another window on the right origin", async () => {
    const { posted, send } = setup();
    send("ready", {}, { source: window });
    await flush();
    expect(posted).not.toHaveBeenCalled();
  });

  it("ignores the wrong instance", async () => {
    const { posted, onEvent, controller } = setup();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: "tally-embed", v: 1, instance: "other", type: "ready", payload: {} },
        origin: EMBED,
        source: controller.iframe.contentWindow,
      }),
    );
    await flush();
    expect(posted).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("refreshes the token on token_request", async () => {
    let n = 0;
    const getSessionToken = vi.fn(async () => `tok-${++n}`);
    const { posted, send } = setup("inline", getSessionToken);
    send("ready");
    await flush();
    send("token_request");
    await flush();
    expect(getSessionToken).toHaveBeenCalledTimes(2);
    expect(posted.mock.calls[1]![0]).toMatchObject({ type: "token", payload: { token: "tok-2" } });
  });

  it("maps event, error and close to the callbacks and ignores unknown types", () => {
    const { send, onEvent, onError, onClose } = setup();
    send("event", { name: "stocktake.confirmed", data: { scanId: "s1" } });
    send("error", { code: "grant_revoked", message: "Revoked" });
    send("mystery", { anything: true });
    send("close");
    expect(onEvent).toHaveBeenCalledWith({ name: "stocktake.confirmed", data: { scanId: "s1" } });
    expect(onError).toHaveBeenCalledWith({ code: "grant_revoked", message: "Revoked" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports a failed token fetch through onError", async () => {
    const { send, onError, posted } = setup("inline", vi.fn(async () => Promise.reject(new Error("401"))));
    send("ready");
    await flush();
    expect(posted).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ code: "unknown", message: "401" });
  });

  it("sets the inline height from resize", () => {
    const { controller, send } = setup();
    send("resize", { height: 812.4 });
    expect(controller.iframe.style.height).toBe("813px");
  });

  it("validates the theme before posting it", async () => {
    const { controller, posted, send } = setup();
    send("ready");
    await flush();
    controller.setTheme({ primary: "red", primaryInk: "#112233", radius: 99, colorScheme: "dark" });
    expect(posted.mock.calls[1]![0]).toMatchObject({
      type: "theme",
      payload: { theme: { primaryInk: "#112233", colorScheme: "dark" } },
    });
  });

  it("opens and closes the modal with Escape and the backdrop, returning focus", () => {
    const button = document.createElement("button");
    const { controller, onClose } = setup("modal");
    document.body.appendChild(button);
    button.focus();
    const sheet = controller.iframe.parentElement!;
    const overlay = sheet.parentElement!;
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(overlay.style.display).toBe("none");

    controller.open();
    expect(overlay.style.display).toBe("flex");
    expect(document.activeElement).toBe(controller.iframe);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(overlay.style.display).toBe("none");
    expect(document.activeElement).toBe(button);

    controller.open();
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(overlay.style.display).toBe("none");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("uses a full-screen sheet under 768 px", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
    const { controller } = setup("modal");
    controller.open();
    expect(controller.iframe.parentElement!.style.width).toBe("100%");
  });

  it.each(["inline", "modal"] as const)("destroy (%s) removes every listener and node", (mode) => {
    const added: unknown[] = [];
    const removed: unknown[] = [];
    // jsdom gives window its own listener methods, separate from EventTarget.prototype.
    for (const target of [window, EventTarget.prototype]) {
      const add = target.addEventListener;
      const remove = target.removeEventListener;
      vi.spyOn(target, "addEventListener").mockImplementation(function (this: EventTarget, type, fn, o) {
        added.push(fn);
        return add.call(this, type, fn, o);
      });
      vi.spyOn(target, "removeEventListener").mockImplementation(function (this: EventTarget, type, fn, o) {
        removed.push(fn);
        return remove.call(this, type, fn, o);
      });
    }
    const { controller, send, onEvent } = setup(mode);
    expect(added.length).toBe(mode === "modal" ? 4 : 1);
    controller.destroy();
    expect(removed.sort()).toEqual(added.sort());
    expect(controller.iframe.isConnected).toBe(false);
    expect(document.body.children.length).toBe(1);
    send("event", { name: "photo.uploaded" });
    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe("sanitizeTheme", () => {
  it("drops bad values", () => {
    expect(
      sanitizeTheme({
        primary: "#0F766E",
        primaryForeground: "#fff",
        primaryInk: "javascript:alert(1)",
        colorScheme: "sepia",
        radius: -1,
        extra: "x",
      }),
    ).toEqual({ primary: "#0F766E" });
    expect(sanitizeTheme({ radius: 24, colorScheme: "auto" })).toEqual({ radius: 24, colorScheme: "auto" });
    expect(sanitizeTheme("nope")).toEqual({});
  });
});

describe("connect", () => {
  let assign: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      origin: window.location.origin,
      search: "?code=c1&state=s1",
      assign,
    } as Location);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1280);
  });

  it("redirects in redirect mode", () => {
    connect({ authorizeUrl: "https://mp.example/oauth/authorize?x=1", mode: "redirect" });
    expect(assign).toHaveBeenCalledWith("https://mp.example/oauth/authorize?x=1");
  });

  it("falls back to redirect when the popup is blocked", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    connect({ authorizeUrl: "https://mp.example/a", mode: "popup" });
    expect(open).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith("https://mp.example/a");
  });

  it("falls back to redirect on a small viewport", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
    const open = vi.spyOn(window, "open");
    connect({ authorizeUrl: "https://mp.example/a", mode: "popup" });
    expect(open).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("https://mp.example/a");
  });

  it("returns the popup result from the same origin only", () => {
    const popup = { closed: false } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);
    const onResult = vi.fn();
    connect({ authorizeUrl: "https://mp.example/a", mode: "popup", onResult });
    const data = { source: "tally-connect", v: 1, search: "?code=c1&state=s1" };
    window.dispatchEvent(new MessageEvent("message", { data, origin: "https://evil.example", source: popup }));
    expect(onResult).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin, source: popup }));
    expect(onResult).toHaveBeenCalledWith({ code: "c1", state: "s1" });
  });

  it("completeConnect posts the query to the opener on its own origin", () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, "opener", { value: { postMessage }, configurable: true });
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    completeConnect();
    expect(postMessage).toHaveBeenCalledWith(
      { source: "tally-connect", v: 1, search: "?code=c1&state=s1" },
      window.location.origin,
    );
    expect(close).toHaveBeenCalled();
    Object.defineProperty(window, "opener", { value: null, configurable: true });
  });
});
