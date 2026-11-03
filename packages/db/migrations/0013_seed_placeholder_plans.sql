-- =====================================================================
-- 0013_seed_placeholder_plans
-- Seeds the two plans every business's stock-take usage is limited by.
--
-- WHY (docs/architecture/database.md):
--   * A business with no business_subscriptions row is on 'free', so the
--     'free' row must exist before the API checks limits.
--   * These values are PLACEHOLDERS. Change them later with a new migration
--     or an admin update, never by editing this file.
--   * price_kobo_monthly is display only (Pro = NGN 15,000 a month). Subscribing
--     is simulated: no payments, invoices or revenue come from plan prices.
--   * ON CONFLICT DO NOTHING: re-running never overwrites a later change.
--
-- No grants here (apps/api connects as the owner).
--
-- ROLLBACK (manual, staging only): delete from tally.plans where code in
-- ('free', 'pro'), after deleting any business_subscriptions that use them.
-- =====================================================================

INSERT INTO tally.plans (code, name, price_kobo_monthly, daily_stocktake_limit, max_concurrent_runs, sort)
VALUES
  ('free', 'Free', 0, 5, 1, 0),
  ('pro', 'Pro', 1500000, 100, 3, 1)
ON CONFLICT (code) DO NOTHING;
