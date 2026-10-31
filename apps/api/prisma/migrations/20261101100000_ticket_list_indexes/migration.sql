-- The staff queue lists a workspace's tickets oldest or newest first (created_at), and the
-- author list newest first; the existing indexes lead with status or author, so those sorts read
-- every ticket of the workspace. Two plain b-tree indexes, additive only: no table rewrite, no
-- data change. IF NOT EXISTS keeps a re-run harmless.
-- On a very large table, build them by hand first with CREATE INDEX CONCURRENTLY under the same
-- names; this migration then does nothing. Rollback: DROP INDEX on either name (no data lost).

CREATE INDEX IF NOT EXISTS "tickets_workspace_id_created_at_idx" ON "tickets"("workspace_id", "created_at");

CREATE INDEX IF NOT EXISTS "tickets_workspace_id_updated_at_idx" ON "tickets"("workspace_id", "updated_at");
