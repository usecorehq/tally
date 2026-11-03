/**
 * Connect Tally app credentials and URL rules, shared by apps/api and the CTO's oauth-client-create script
 * so both mint and check them the same way. Only the secret's sha256 is ever stored.
 */

import { createHash, randomBytes, randomInt } from "node:crypto";

export const OAUTH_CLIENT_SCOPES = ["stocktake:write", "stocktake:read", "inventory:read"] as const;

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** `tc_` + 24 `[a-z0-9]`, as the oauth_clients_client_id_format check requires. */
export function newClientId(): string {
  return "tc_" + Array.from({ length: 24 }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join("");
}

/** `tcs_` + 43 base64url chars; the prefix (8 chars after `tcs_`) recognises a key without revealing it. */
export function newClientSecret(): { secret: string; secretHash: string; secretPrefix: string } {
  const secret = "tcs_" + randomBytes(32).toString("base64url");
  return { secret, secretHash: createHash("sha256").update(secret).digest("hex"), secretPrefix: secret.slice(4, 12) };
}

function parseHttps(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Why a redirect URI is not allowed, or null. OAuth redirect URIs may not carry a fragment. */
export function redirectUriProblem(value: string): string | null {
  const url = parseHttps(value);
  if (!url) return `must be an https URL: ${value}`;
  if (url.hash) return `must not have a #fragment: ${value}`;
  return null;
}

/** Why an iframe origin is not allowed, or null. It is compared with frame-ancestors, so it must be bare. */
export function originProblem(value: string): string | null {
  const url = parseHttps(value);
  if (!url) return `must be an https origin: ${value}`;
  if (url.origin !== value) return `must be a bare origin (no path or trailing slash): ${value}`;
  return null;
}
