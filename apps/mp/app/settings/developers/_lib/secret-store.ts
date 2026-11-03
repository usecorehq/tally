import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import type { HeldSecret } from "./developer";

/*
 * A just-issued client secret, held for 10 minutes in an AES-256-GCM encrypted, httpOnly cookie bound to
 * the user and app, so the page payload never carries it. The API keeps only its hash.
 */

export const HOLD_SECONDS = 600;
const PATH = "/settings/developers";
function name(clientId: string): string {
  if (!/^tc_[a-z0-9]{24}$/.test(clientId)) throw new Error("Not a client id");
  return `tally_dev_secret_${clientId}`;
}

type Sealed = { s: string; u: string; c: string; exp: number };

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`tally-developer-secret:${secret}`).digest();
}

function seal(value: Sealed): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

function unseal(raw: string): Sealed | null {
  try {
    const buf = Buffer.from(raw, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8")) as Sealed;
  } catch {
    return null;
  }
}

const userId = async () => (await auth())?.user?.id ?? null;

/** Server Functions only (it sets a cookie). Returns what the page may show: never the secret itself. */
export async function holdSecret(clientId: string, secret: string): Promise<HeldSecret> {
  const u = await userId();
  if (!u) throw new Error("Not signed in");
  const exp = Date.now() + HOLD_SECONDS * 1000;
  (await cookies()).set(name(clientId), seal({ s: secret, u, c: clientId, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: PATH,
    maxAge: HOLD_SECONDS,
  });
  return { last4: secret.slice(-4), expiresAt: new Date(exp).toISOString() };
}

/** The held secret for this user and app, or null once it expired, was dropped or belongs to someone else. */
async function open(clientId: string): Promise<Sealed | null> {
  if (!/^tc_[a-z0-9]{24}$/.test(clientId)) return null;
  const raw = (await cookies()).get(name(clientId))?.value;
  const sealed = raw ? unseal(raw) : null;
  if (!sealed || sealed.c !== clientId || sealed.exp <= Date.now()) return null;
  return sealed.u === (await userId()) ? sealed : null;
}

export async function readSecret(clientId: string): Promise<string | null> {
  return (await open(clientId))?.s ?? null;
}

export async function heldSecret(clientId: string): Promise<HeldSecret | null> {
  const sealed = await open(clientId);
  return sealed && { last4: sealed.s.slice(-4), expiresAt: new Date(sealed.exp).toISOString() };
}

/** Server Functions only. */
export async function dropSecret(clientId: string): Promise<void> {
  (await cookies()).delete({ name: name(clientId), path: PATH });
}
