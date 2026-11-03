import type { StrategyFactory } from "../core";
import { resolveContainer } from "./container";

export const inlineStrategy: StrategyFactory = (iframe, options) => {
  const container = resolveContainer(options.container);
  // Fill the container until the frame reports its content height.
  Object.assign(iframe.style, { height: "100%", minHeight: "480px" });
  container.appendChild(iframe);

  return {
    show: () => {
      iframe.style.display = "block";
    },
    hide: () => {
      iframe.style.display = "none";
    },
    resize: (height) => {
      Object.assign(iframe.style, { height: `${Math.max(0, Math.ceil(height))}px`, minHeight: "0" });
    },
    teardown: () => iframe.remove(),
  };
};
