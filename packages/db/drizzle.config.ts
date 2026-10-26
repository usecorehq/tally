import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// One env file at the repo root; drizzle-kit runs with cwd = packages/db.
config({ path: resolve(__dirname, "../../.env") });

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
