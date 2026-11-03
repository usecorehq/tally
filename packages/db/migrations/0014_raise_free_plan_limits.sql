-- =====================================================================
-- 0014_raise_free_plan_limits
-- Raises the Free plan from 5 stock-takes a day and 1 running at a time
-- to 50 a day and 2 at a time.
--
-- WHY (docs/architecture/database.md):
--   * Every business without a subscription is on 'free', and runs,
--     reruns and quick scans all count. At 5 a day, normal use and demos
--     hit the limit within hours.
--   * Pro stays at 100 a day and 3 at a time.
--   * 0013 is applied and frozen, so the change is a new migration.
--
-- No grants here (apps/api connects as the owner).
--
-- ROLLBACK (manual, staging only): update tally.plans set
-- daily_stocktake_limit = 5, max_concurrent_runs = 1 where code = 'free'.
-- =====================================================================

UPDATE tally.plans
SET daily_stocktake_limit = 50, max_concurrent_runs = 2
WHERE code = 'free';
