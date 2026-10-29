import { config, parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// The root .env wins; if it leaves SUPABASE_DB_URL empty, fall back to apps/api/.env
// (checked explicitly because dotenv never replaces a key set to "").
config({ path: resolve(__dirname, "../../.env"), quiet: true });
const apiEnv = resolve(__dirname, "../../apps/api/.env");
if (!process.env.SUPABASE_DB_URL && existsSync(apiEnv)) {
  process.env.SUPABASE_DB_URL = parse(readFileSync(apiEnv)).SUPABASE_DB_URL ?? "";
}

// `generate` diffs against the snapshot and never connects, so the URL is only
// enforced by drizzle-kit itself when a command actually needs the database.
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL ?? "",
  },
  // Only ever diff/push the tally schema — public.*, auth.* and bookmi.* belong
  // to other projects on the same database.
  schemaFilter: ["tally"],
  // Own ledger table: bookmi's rows in the shared default drizzle.__drizzle_migrations
  // would make the migrator skip our older migrations.
  migrations: {
    schema: "tally",
    table: "__drizzle_migrations",
  },
  strict: true,
  verbose: true,
});
