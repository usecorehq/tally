/**
 * Tally drizzle schema — the shared Qorelly Supabase Postgres, isolated in the
 * `tally` schema. Identity is Qorelly's auth.users; tally tables reference
 * auth.users(id) by uuid and never write to public.* or auth.*.
 *
 * Migration workflow:
 *   pnpm db:generate --name=<what_changed>
 *   pnpm db:migrate            (staging only — production is applied by the CTO)
 *
 * Always pass --name; migrations are named semantically after what they do
 * (e.g. tally_setup, add_vision_datasets) — never drizzle's random codenames.
 * Applied migration files are frozen.
 */

import { pgSchema } from "drizzle-orm/pg-core";

export const tally = pgSchema("tally");
