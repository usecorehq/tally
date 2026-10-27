import { config, parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs with cwd = packages/db. The root .env wins; if it leaves
// SUPABASE_DB_URL empty, take it from apps/api/.env (where the API keeps it).
// Checked explicitly because dotenv never replaces a key set to "".
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
  // The shared database also hosts bookmi, whose ledger sits in the default
  // drizzle.__drizzle_migrations. Drizzle's migrator skips any migration older
  // than the newest ledger row, so sharing that table would silently drop ours.
  migrations: {
    schema: "tally",
    table: "__drizzle_migrations",
  },
  strict: true,
  verbose: true,
});
