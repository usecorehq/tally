// Registers a Connect Tally partner app (CTO only) or suspends one. Prints the secret once; only its
// sha256 is stored. Usage: apps/api/README.md#connect-tally-clients.
import { createHash, randomBytes, randomInt } from "node:crypto";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const { buildTallyDb, eq, schema, sql } = require("@tally/db");

const SCOPES = ["stocktake:write", "stocktake:read", "inventory:read"];
const USAGE = [
  'Usage: node --env-file=apps/api/.env apps/api/scripts/oauth-client-create.mjs --name "<app name>" --redirect-uri <https url> [--redirect-uri …]',
  "         [--origin <https origin> …] [--scope <scope> …] [--cap <daily stock-takes>] [--concurrent <runs>]",
  "       node --env-file=apps/api/.env apps/api/scripts/oauth-client-create.mjs --suspend <client_id>",
].join("\n");

const { values: opts } = parseArgs({
  options: {
    name: { type: "string" },
    "redirect-uri": { type: "string", multiple: true },
    origin: { type: "string", multiple: true },
    scope: { type: "string", multiple: true },
    cap: { type: "string" },
    concurrent: { type: "string" },
    suspend: { type: "string" },
  },
});

function fail(message) {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

function httpsUrl(value, what) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${what} is not a URL: ${value}`);
  }
  if (url.protocol !== "https:") fail(`${what} must be https: ${value}`);
  return url;
}

function positiveInt(value, what) {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) fail(`${what} must be a positive whole number: ${value}`);
  return Number(value);
}

const { SUPABASE_DB_URL } = process.env;
if (!SUPABASE_DB_URL) fail("SUPABASE_DB_URL is not set.");

let insert;
if (!opts.suspend) {
  const name = opts.name?.trim() ?? "";
  if (name.length < 1 || name.length > 80) fail("--name is required (1–80 characters).");
  const redirectUris = opts["redirect-uri"] ?? [];
  if (redirectUris.length < 1 || redirectUris.length > 10) fail("Give 1–10 --redirect-uri values.");
  for (const uri of redirectUris) {
    // OAuth redirect URIs may not carry a fragment.
    if (httpsUrl(uri, "--redirect-uri").hash) fail(`--redirect-uri must not have a #fragment: ${uri}`);
  }
  const origins = opts.origin ?? [];
  for (const origin of origins) {
    if (httpsUrl(origin, "--origin").origin !== origin) fail(`--origin must be a bare origin (no path or trailing slash): ${origin}`);
  }
  const scopes = [...new Set(opts.scope ?? SCOPES)];
  for (const scope of scopes) if (!SCOPES.includes(scope)) fail(`Unknown --scope ${scope}; allowed: ${SCOPES.join(", ")}`);

  const clientId = "tc_" + Array.from({ length: 24 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[randomInt(36)]).join("");
  const secret = "tcs_" + randomBytes(32).toString("base64url");
  insert = {
    secret,
    row: {
      clientId,
      name,
      secretHash: createHash("sha256").update(secret).digest("hex"),
      secretPrefix: secret.slice(4, 12),
      redirectUris,
      allowedOrigins: origins,
      allowedScopes: scopes,
      dailyStocktakeCap: positiveInt(opts.cap, "--cap"),
      maxConcurrentRuns: positiveInt(opts.concurrent, "--concurrent"),
    },
  };
}

const db = buildTallyDb(SUPABASE_DB_URL, { max: 1 });
const c = schema.oauthClients;

try {
  if (opts.suspend) {
    const [row] = await db
      .update(c)
      .set({ status: "suspended", updatedAt: sql`now()` })
      .where(eq(c.clientId, opts.suspend))
      .returning({ clientId: c.clientId, name: c.name, status: c.status });
    if (!row) throw new Error(`No client ${opts.suspend}.`);
    console.log(`${row.clientId} (${row.name}) is now ${row.status}.`);
  } else {
    const [row] = await db
      .insert(c)
      .values(insert.row)
      .returning({
        clientId: c.clientId,
        name: c.name,
        scopes: c.allowedScopes,
        cap: c.dailyStocktakeCap,
        concurrent: c.maxConcurrentRuns,
      });
    console.log(`Registered ${row.name}`);
    console.log(`  scopes: ${row.scopes.join(", ")}; daily stock-take cap ${row.cap}; ${row.concurrent} concurrent runs`);
    console.log(`  client_id:     ${row.clientId}`);
    console.log(`  client_secret: ${insert.secret}`);
    console.log("This secret cannot be shown again. Only its sha256 is stored; hand it to the partner securely.");
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await db.$client?.end?.({ timeout: 5 });
}
