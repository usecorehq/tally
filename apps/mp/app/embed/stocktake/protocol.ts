// postMessage protocol v1 between the launcher and this iframe (docs/architecture/embed.md).

export const SOURCE = "tally-embed";
export const VERSION = 1;

export type Theme = {
  primary?: string;
  primaryForeground?: string;
  primaryInk?: string;
  colorScheme?: "light" | "dark" | "auto";
  radius?: number;
};

export type Mode = "inline" | "modal";

export type EventName = "photo.uploaded" | "stocktake.started" | "stocktake.review" | "stocktake.confirmed" | "limit.reached";
export type ErrorCode = "grant_revoked" | "token_expired" | "origin_not_allowed" | "network" | "unknown";

export type Outgoing =
  | { type: "ready"; payload: Record<string, never> }
  | { type: "token_request"; payload: Record<string, never> }
  | { type: "resize"; payload: { height: number } }
  | { type: "event"; payload: { name: EventName; data: unknown } }
  | { type: "error"; payload: { code: ErrorCode; message: string } }
  | { type: "close"; payload: Record<string, never> };

export type Incoming =
  | { type: "init"; payload: { token: string; theme?: Theme; mode: Mode } }
  | { type: "token"; payload: { token: string } }
  | { type: "theme"; payload: { theme: Theme } };

export const envelope = (instance: string, msg: Outgoing) => ({ source: SOURCE, v: VERSION, instance, ...msg });

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** A host message for this instance, or null; origin and window are checked by the caller. Unknown types are ignored. */
export function parseIncoming(data: unknown, instance: string): Incoming | null {
  if (!isObject(data) || data.source !== SOURCE || data.v !== VERSION || data.instance !== instance) return null;
  const p = data.payload;
  if (!isObject(p)) return null;
  switch (data.type) {
    case "init":
      if (typeof p.token !== "string" || !p.token) return null;
      return { type: "init", payload: { token: p.token, theme: sanitiseTheme(p.theme), mode: p.mode === "modal" ? "modal" : "inline" } };
    case "token":
      return typeof p.token === "string" && p.token ? { type: "token", payload: { token: p.token } } : null;
    case "theme":
      return { type: "theme", payload: { theme: sanitiseTheme(p.theme) ?? {} } };
    default:
      return null;
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Keeps only valid fields: #rrggbb colours, a known colour scheme, a radius of 0–24. */
export function sanitiseTheme(input: unknown): Theme | undefined {
  if (!isObject(input)) return undefined;
  const theme: Theme = {};
  for (const key of ["primary", "primaryForeground", "primaryInk"] as const) {
    const v = input[key];
    if (typeof v === "string" && HEX.test(v)) theme[key] = v;
  }
  if (input.colorScheme === "light" || input.colorScheme === "dark" || input.colorScheme === "auto") theme.colorScheme = input.colorScheme;
  if (typeof input.radius === "number" && Number.isFinite(input.radius) && input.radius >= 0 && input.radius <= 24) theme.radius = input.radius;
  return theme;
}

const VARS = { primary: "--color-primary", primaryForeground: "--color-primary-foreground", primaryInk: "--color-primary-ink" } as const;

/** Sets the theme on <html>; a later theme replaces the earlier one. Returns a cleanup for the 'auto' listener. */
export function applyTheme(theme: Theme): () => void {
  const root = document.documentElement;
  for (const [key, name] of Object.entries(VARS) as [keyof typeof VARS, string][]) {
    const v = theme[key];
    if (v) root.style.setProperty(name, v);
    else root.style.removeProperty(name);
  }
  // Buttons use rounded-xl; sheets keep their own radius.
  if (theme.radius !== undefined) root.style.setProperty("--radius-xl", `${theme.radius}px`);
  else root.style.removeProperty("--radius-xl");
  const scheme = theme.colorScheme ?? "auto";
  if (scheme !== "auto") {
    root.classList.toggle("dark", scheme === "dark");
    return () => undefined;
  }
  const media = matchMedia("(prefers-color-scheme: dark)");
  const follow = () => root.classList.toggle("dark", media.matches);
  follow();
  media.addEventListener("change", follow);
  return () => media.removeEventListener("change", follow);
}

/** The session token's claims, read without verifying (the API verifies); null if it isn't a JWT. */
export function readClaims(token: string): { bid: string; scope: string[]; exp: number | null; mock?: string } | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
    if (!isObject(json) || typeof json.bid !== "string") return null;
    return {
      bid: json.bid,
      scope: typeof json.scope === "string" ? json.scope.split(" ").filter(Boolean) : [],
      exp: typeof json.exp === "number" ? json.exp : null,
      ...(typeof json.mock === "string" && { mock: json.mock }),
    };
  } catch {
    return null;
  }
}
