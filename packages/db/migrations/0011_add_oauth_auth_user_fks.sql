-- =====================================================================
-- 0011_add_oauth_auth_user_fks
-- Ties OAuth codes and grants (Connect Tally) to the merchant who consented.
--
-- WHY (docs/architecture/database.md):
--   * oauth_codes.user_id and oauth_grants.user_id are Qorelly auth.users ids.
--     The reference is cross-schema, so it is custom SQL, not Drizzle (as in 0002).
--   * ON DELETE CASCADE: a deleted user's pending codes and consents go with them.
--
-- No grants here (apps/api connects as the owner).
--
-- ROLLBACK (manual, staging only): drop oauth_grants_user_fk, then
-- oauth_codes_user_fk, in reverse order of this file.
-- =====================================================================

ALTER TABLE tally.oauth_codes
  ADD CONSTRAINT oauth_codes_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE tally.oauth_grants
  ADD CONSTRAINT oauth_grants_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
