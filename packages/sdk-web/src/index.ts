import { createEmbed } from "./core";
import { inlineStrategy } from "./strategy/inline";
import { modalStrategy } from "./strategy/modal";
import type { EmbedController, MountOptions } from "./types";

export { connect, completeConnect } from "./connect";
export type {
  ConnectOptions,
  ConnectResult,
  EmbedController,
  EmbedError,
  EmbedEvent,
  MountOptions,
  Theme,
} from "./types";

export function mount(options: MountOptions): EmbedController {
  return createEmbed(options, options.mode === "modal" ? modalStrategy : inlineStrategy);
}
