import type { SolarIconName } from "@tally/ui";

export const AUTHORIZE_PATH = "/oauth/authorize";

/** The query a partner app sends to /oauth/authorize (contracts §7). */
export type AuthorizeParams = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  display: "page" | "popup";
};

/** GET /clients/v1/oauth/authorize-info */
export type AuthorizeInfo = {
  client: { client_id: string; name: string; logo_url: string | null };
  scopes: { scope: string; description: string }[];
  businesses: { id: string; name: string; connected: boolean }[];
};

type RawQuery = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseAuthorizeParams(query: RawQuery): AuthorizeParams {
  return {
    responseType: first(query.response_type),
    clientId: first(query.client_id),
    redirectUri: first(query.redirect_uri),
    scope: first(query.scope),
    state: first(query.state),
    codeChallenge: first(query.code_challenge),
    codeChallengeMethod: first(query.code_challenge_method),
    display: first(query.display) === "popup" ? "popup" : "page",
  };
}

/** The same consent URL as a same-origin path, for login's callbackUrl and the new-business returnTo. */
export function authorizePath(query: RawQuery): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) qs.append(key, v);
  }
  const s = qs.toString();
  return s ? `${AUTHORIZE_PATH}?${s}` : AUTHORIZE_PATH;
}

/** A redirect back to the partner app; only ever called once its redirect_uri has been validated. */
export function clientRedirect(redirectUri: string, params: Record<string, string>, state: string): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

/** returnTo from /businesses/new is honoured only as a same-origin path back to consent. */
export function safeReturnTo(value: string | undefined): string | null {
  if (!value || !value.startsWith(AUTHORIZE_PATH) || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "http://tally.invalid");
    if (url.origin !== "http://tally.invalid" || url.pathname !== AUTHORIZE_PATH) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/** Plain words per scope (contracts §3); the API's own description wins when it sends one. */
export const SCOPES: Record<string, { icon: SolarIconName; text: string }> = {
  "stocktake:write": { icon: "Gallery-Add", text: "Run stock-takes and update your stock" },
  "stocktake:read": { icon: "History", text: "See your stock-take history and results" },
  "inventory:read": { icon: "Box", text: "See your inventory" },
};

export const scopeIcon = (scope: string): SolarIconName => SCOPES[scope]?.icon ?? "Lock";
export const scopeText = (scope: string, description?: string) => description || SCOPES[scope]?.text || scope;
