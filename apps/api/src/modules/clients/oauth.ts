import { HttpException, HttpStatus } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Scope → the plain words on the consent screen. Order here is the canonical order in tokens. */
export const OAUTH_SCOPES = {
  "stocktake:write": "Run stock-takes and update your stock",
  "stocktake:read": "See your stock-take history and results",
  "inventory:read": "See your inventory",
} as const;
export type OauthScope = keyof typeof OAUTH_SCOPES;

export const CODE_TTL_SECONDS = 60;
export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_TOKEN_TTL_SECONDS = 900;
export const CLIENT_TOKEN_AUDIENCE = "tally-client";
export const EMBED_TOKEN_AUDIENCE = "tally-embed";
export const TOKEN_ISSUER = "tally";

/** RFC 7636: a verifier is 43–128 unreserved chars; an S256 challenge is 32 bytes base64url. */
export const PKCE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
export const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
export const CLIENT_ID = /^tc_[a-z0-9]{24}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 6749 error body: `{ error, error_description }`. */
export class OAuthError extends HttpException {
  constructor(error: string, description: string, status: number = HttpStatus.BAD_REQUEST) {
    super({ error, error_description: description }, status);
  }
}

export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const pkceS256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
export const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export function hexEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** Space-separated scopes, deduped in canonical order; null when empty or any scope is unknown. */
export function parseScope(raw: string): OauthScope[] | null {
  const asked = new Set(raw.split(" ").filter(Boolean));
  if (asked.size === 0) return null;
  const known = Object.keys(OAUTH_SCOPES) as OauthScope[];
  if ([...asked].some((s) => !known.includes(s as OauthScope))) return null;
  return known.filter((s) => asked.has(s));
}

/** RFC 6749 §2.3.1: id and secret are form-encoded before base64. */
export function parseBasicAuth(header: string | undefined): { clientId: string; secret: string } | null {
  if (!header || !/^basic /i.test(header)) return null;
  const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon <= 0) return null;
  try {
    const clientId = decodeURIComponent(decoded.slice(0, colon).replace(/\+/g, " "));
    const secret = decodeURIComponent(decoded.slice(colon + 1).replace(/\+/g, " "));
    return secret ? { clientId, secret } : null;
  } catch {
    return null;
  }
}
