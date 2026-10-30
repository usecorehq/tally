import type { StrategyFactory } from "../core";
import { MOBILE_MAX_WIDTH } from "../protocol";

export const modalStrategy: StrategyFactory = (iframe, _options, listen, requestClose) => {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(17, 17, 17, 0.48)",
  });

  const sheet = document.createElement("div");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", "Tally stock-take");
  Object.assign(sheet.style, { overflow: "hidden", background: "transparent" });
  iframe.style.height = "100%";
  sheet.appendChild(iframe);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  let open = false;
  let returnFocus: HTMLElement | null = null;
  let previousOverflow = "";

  const layout = () => {
    const full = window.innerWidth <= MOBILE_MAX_WIDTH;
    Object.assign(sheet.style, {
      width: full ? "100%" : "min(720px, calc(100vw - 32px))",
      height: full ? "100%" : "85vh",
      borderRadius: full ? "0" : "16px",
      boxShadow: full ? "none" : "0 24px 64px rgba(0, 0, 0, 0.24)",
    });
  };

  listen(window, "resize", () => {
    if (open) layout();
  });
  listen(document, "keydown", (event) => {
    if (open && (event as KeyboardEvent).key === "Escape") requestClose();
  });
  listen(overlay, "click", (event) => {
    if (event.target === overlay) requestClose();
  });

  return {
    show: () => {
      if (open) return;
      open = true;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      layout();
      overlay.style.display = "flex";
      iframe.focus();
    },
    hide: () => {
      if (!open) return;
      open = false;
      overlay.style.display = "none";
      document.documentElement.style.overflow = previousOverflow;
      returnFocus?.focus();
      returnFocus = null;
    },
    resize: () => {},
    teardown: () => overlay.remove(),
  };
};
