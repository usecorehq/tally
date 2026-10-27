-- IF NOT EXISTS: drizzle's migrator creates the ledger's schema (tally) before
-- applying migrations, so a plain CREATE SCHEMA fails on the first run.
CREATE SCHEMA IF NOT EXISTS "tally";
