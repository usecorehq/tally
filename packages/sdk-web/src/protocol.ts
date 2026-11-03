import type { Theme } from "./types";

export const EMBED_SOURCE = "tally-embed";
export const CONNECT_SOURCE = "tally-connect";
export const PROTOCOL_VERSION = 1;
export const DEFAULT_EMBED_ORIGIN = "https://embed.tally.qorelly.com";
export const MOBILE_MAX_WIDTH = 767;

export type Envelope = {
  source: typeof EMBED_SOURCE;
  v: typeof PROTOCOL_VERSION;
  instance: string;
  type: string;
  payload: Record<string, unknown>;
};

export function envelope(instance: string, type: string, payload: Record<string, unknown>): Envelope {
  return { source: EMBED_SOURCE, v: PROTOCOL_VERSION, instance, type, payload };
}

export function isEnvelope(data: unknown, instance: string): data is Envelope {
  if (!isRecord(data)) return false;
  return (
    data.source === EMBED_SOURCE &&
    data.v === PROTOCOL_VERSION &&
    data.instance === instance &&
    typeof data.type === "string" &&
    (data.payload === undefined || isRecord(data.payload))
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const COLOUR = /^#[0-9a-fA-F]{6}$/;
const COLOUR_KEYS = ["primary", "primaryForeground", "primaryInk"] as const;
const SCHEMES = ["light", "dark", "auto"];

// Same rules as the iframe applies, so a bad value never crosses the boundary.
export function sanitizeTheme(input: unknown): Theme {
  const theme: Theme = {};
  if (!isRecord(input)) return theme;
  for (const key of COLOUR_KEYS) {
    const value = input[key];
    if (typeof value === "string" && COLOUR.test(value)) theme[key] = value;
  }
  if (typeof input.colorScheme === "string" && SCHEMES.includes(input.colorScheme)) {
    theme.colorScheme = input.colorScheme as Theme["colorScheme"];
  }
  const radius = input.radius;
  if (typeof radius === "number" && Number.isFinite(radius) && radius >= 0 && radius <= 24) {
    theme.radius = radius;
  }
  return theme;
}

export function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
