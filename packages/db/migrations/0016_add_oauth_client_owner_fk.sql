-- =====================================================================
-- 0016_add_oauth_client_owner_fk
-- Ties a self-served Connect Tally app to the Qorelly user who manages it.
--
-- WHY (docs/architecture/database.md):
--   * oauth_clients.owner_user_id is a Qorelly auth.users id. The reference
--     is cross-schema, so it is custom SQL, not Drizzle (as in 0011).
--   * ON DELETE SET NULL: merchants who connected the app keep it working
--     after its developer's account goes; the CTO then manages it, as for
--     the script-made apps where owner_user_id is null.
--
-- No grants here (apps/api connects as the owner).
--
-- ROLLBACK (manual, staging only): drop oauth_clients_owner_fk.
-- =====================================================================

ALTER TABLE tally.oauth_clients
  ADD CONSTRAINT oauth_clients_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
