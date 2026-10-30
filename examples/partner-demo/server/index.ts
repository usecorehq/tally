import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const API = env("TALLY_API_URL").replace(/\/$/, "");
const AUTHORIZE_URL = env("TALLY_AUTHORIZE_URL");
const EMBED_ORIGIN = env("TALLY_EMBED_ORIGIN");
const CLIENT_ID = env("TALLY_CLIENT_ID");
const CLIENT_SECRET = env("TALLY_CLIENT_SECRET");
const BASE_URL = env("DEMO_BASE_URL").replace(/\/$/, "");
const SESSION_SECRET = env("SESSION_SECRET");
const PORT = Number(process.env.PORT ?? 4200);
const REDIRECT_URI = `${BASE_URL}/callback`;
const SCOPE = "stocktake:write stocktake:read inventory:read";
const WEB_ROOT = fileURLToPath(new URL("./web", import.meta.url));
const COOKIE = "demo_session";

type Pending = { verifier: string; state: string; mode: "redirect" | "popup" };
type Session = { sid: string; pending?: Pending };
type Tokens = { access: string; refresh: string; expiresAt: number; businessId: string };

// Tokens stay in server memory, keyed by the cookie's session id; a restart disconnects everyone.
const tokens = new Map<string, Tokens>();

const b64url = (buf: Buffer) => buf.toString("base64url");
const basic = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;

async function readSession(c: Context): Promise<Session> {
  const raw = await getSignedCookie(c, SESSION_SECRET, COOKIE);
  if (raw) {
    try {
      return JSON.parse(Buffer.from(raw, "base64url").toString()) as Session;
    } catch {}
  }
  return { sid: b64url(randomBytes(18)) };
}

async function writeSession(c: Context, session: Session) {
  await setSignedCookie(c, COOKIE, b64url(Buffer.from(JSON.stringify(session))), SESSION_SECRET, {
    httpOnly: true,
    secure: BASE_URL.startsWith("https://"),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens | null> {
  const res = await fetch(`${API}/clients/v1/oauth/token`, {
    method: "POST",
    headers: { authorization: basic, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    business_id: string;
  };
  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    businessId: json.business_id,
  };
}

// Refresh 30 s early; a failed refresh (rotated or revoked grant) means disconnected.
async function accessToken(sid: string): Promise<string | null> {
  const current = tokens.get(sid);
  if (!current) return null;
  if (current.expiresAt - 30_000 > Date.now()) return current.access;
  const next = await tokenRequest({ grant_type: "refresh_token", refresh_token: current.refresh });
  if (next) tokens.set(sid, next);
  else tokens.delete(sid);
  return next?.access ?? null;
}

async function tally(c: Context, path: string, init: RequestInit = {}) {
  const { sid } = await readSession(c);
  const token = await accessToken(sid);
  if (!token) return c.json({ error: "not_connected" }, 401);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
  if (res.status === 401) tokens.delete(sid);
  return { res, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const app = new Hono();

app.get("/connect", async (c) => {
  const session = await readSession(c);
  const verifier = b64url(randomBytes(32));
  const pending: Pending = {
    verifier,
    state: b64url(randomBytes(16)),
    mode: c.req.query("mode") === "popup" ? "popup" : "redirect",
  };
  await writeSession(c, { sid: session.sid, pending });
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state: pending.state,
    code_challenge: b64url(createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
    display: pending.mode === "popup" ? "popup" : "page",
  }).toString();
  return c.json({ authorizeUrl: url.toString() });
});

app.get("/callback", async (c) => {
  const session = await readSession(c);
  const { pending } = session;
  const code = c.req.query("code");
  if (pending && code && c.req.query("state") === pending.state) {
    const next = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pending.verifier,
    });
    if (next) tokens.set(session.sid, next);
  }
  await writeSession(c, { sid: session.sid });
  if (pending?.mode !== "popup") return c.redirect("/");
  return c.html(await readFile(`${WEB_ROOT}/callback.html`, "utf8"));
});

app.get("/api/me", async (c) => {
  const config = { clientId: CLIENT_ID, embedOrigin: EMBED_ORIGIN };
  const result = await tally(c, "/clients/v1/me");
  if (result instanceof Response || !result.res.ok) return c.json({ connected: false, ...config });
  return c.json({ connected: true, business: result.json.business, ...config });
});

app.post("/api/session", async (c) => {
  const result = await tally(c, "/clients/v1/sessions", { method: "POST" });
  if (result instanceof Response) return result;
  if (!result.res.ok) return c.json(result.json, result.res.status as ContentfulStatusCode);
  return c.json({ sessionToken: result.json.session_token });
});

type ScanLine = { decision: { action: string; itemName: string | null; quantity: number | null } | null };

app.get("/api/stocktake/:scanId", async (c) => {
  const { sid } = await readSession(c);
  const businessId = tokens.get(sid)?.businessId;
  if (!businessId) return c.json({ error: "not_connected" }, 401);
  const scanId = encodeURIComponent(c.req.param("scanId"));
  const result = await tally(c, `/businesses/${businessId}/vision/shelf-scans/${scanId}`);
  if (result instanceof Response) return result;
  if (!result.res.ok) return c.json(result.json, result.res.status as ContentfulStatusCode);
  const detections = (result.json.detections ?? []) as ScanLine[];
  const lines = detections
    .map((d) => d.decision)
    .filter((d): d is NonNullable<ScanLine["decision"]> => !!d && d.action !== "skip")
    .map((d) => ({ name: d.itemName ?? "New item", action: d.action, quantity: d.quantity }));
  return c.json({ scanId: result.json.scanId, status: result.json.status, lines });
});

app.post("/api/disconnect", async (c) => {
  const session = await readSession(c);
  const current = tokens.get(session.sid);
  tokens.delete(session.sid);
  if (current) {
    await fetch(`${API}/clients/v1/oauth/revoke`, {
      method: "POST",
      headers: { authorization: basic, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: current.refresh }),
    }).catch(() => undefined);
  }
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.use("/*", serveStatic({ root: WEB_ROOT }));

serve({ fetch: app.fetch, port: PORT }, () => console.log(`Demo Shop on :${PORT}`));
