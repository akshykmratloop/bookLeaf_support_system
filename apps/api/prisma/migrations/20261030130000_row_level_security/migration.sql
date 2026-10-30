-- S.8: Postgres row-level security on every tenant table (the second lock behind the app's own
-- workspace filters; docs/saas/PLAN.md §5.2).
--
-- Each request runs on a restricted app role (no BYPASSRLS) and sets `app.workspace_id` for its
-- own transaction only (`set_config(..., true)`, safe with pooled connections). These policies
-- then hide every row of other workspaces, even from a query that forgets its workspace filter.
-- FORCE also applies them to the table owner unless it bypasses RLS (a superuser or a role with
-- BYPASSRLS). The owner connection (migrations, signup, sign-in lookups, the AI worker and the
-- webhook sender) must be such a role; the API checks both roles when it starts.
--
-- No column, row or index changes: enabling RLS is metadata only, quick on a populated table.
-- The app role, its password and its grants are not part of this migration (they differ per
-- environment): `node dist/db-roles.js` / `pnpm db:roles` creates and updates them idempotently.
-- Rollback: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` on the tables below (the old code ran as
-- the owner, which these policies do not limit), or restore the pre-deploy backup.

-- 1. The workspace the current transaction runs as; NULL when none is set. `current_setting`
--    returns '' (not NULL) once a transaction-local value has ended, hence the NULLIF.
CREATE OR REPLACE FUNCTION "app_current_workspace_id"() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid
$$;

-- 2. Tables with their own workspace_id: a row is visible, and may be written, only inside its
--    own workspace. NULL never matches, so with nothing set the app role sees no rows at all.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspace_members', 'workspace_connectors', 'customer_fields', 'workspace_settings',
    'workspace_api_keys', 'workspace_provider_keys', 'workspace_webhooks', 'users', 'authors',
    'books', 'tickets', 'ticket_drafts', 'chat_sessions', 'voice_sessions', 'audit_events',
    'ticket_categories', 'knowledge_articles', 'knowledge_article_categories'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "workspace_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "workspace_isolation" ON %I '
      'USING ("workspace_id" = "app_current_workspace_id"()) '
      'WITH CHECK ("workspace_id" = "app_current_workspace_id"())',
      t
    );
  END LOOP;
END
$$;

-- 3. The workspace itself: only its own row (its settings, ticket prefix and number counter).
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON "workspaces";
CREATE POLICY "workspace_isolation" ON "workspaces"
  USING ("id" = "app_current_workspace_id"())
  WITH CHECK ("id" = "app_current_workspace_id"());

-- 4. Child tables without a workspace_id follow their parent row's workspace.
ALTER TABLE "ticket_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON "ticket_messages";
CREATE POLICY "workspace_isolation" ON "ticket_messages"
  USING (EXISTS (SELECT 1 FROM "tickets" t WHERE t."id" = "ticket_messages"."ticket_id"
                 AND t."workspace_id" = "app_current_workspace_id"()))
  WITH CHECK (EXISTS (SELECT 1 FROM "tickets" t WHERE t."id" = "ticket_messages"."ticket_id"
                      AND t."workspace_id" = "app_current_workspace_id"()));

ALTER TABLE "ai_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_jobs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON "ai_jobs";
CREATE POLICY "workspace_isolation" ON "ai_jobs"
  USING (EXISTS (SELECT 1 FROM "tickets" t WHERE t."id" = "ai_jobs"."ticket_id"
                 AND t."workspace_id" = "app_current_workspace_id"()))
  WITH CHECK (EXISTS (SELECT 1 FROM "tickets" t WHERE t."id" = "ai_jobs"."ticket_id"
                      AND t."workspace_id" = "app_current_workspace_id"()));

ALTER TABLE "ai_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_drafts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON "ai_drafts";
CREATE POLICY "workspace_isolation" ON "ai_drafts"
  USING (EXISTS (SELECT 1 FROM "tickets" t WHERE t."id" = "ai_drafts"."ticket_id"
                 AND t."workspace_id" = "app_current_workspace_id"()))
  WITH CHECK (EXISTS (SELECT 1 FROM "tickets" t WHERE t."id" = "ai_drafts"."ticket_id"
                      AND t."workspace_id" = "app_current_workspace_id"()));

-- AI runs of the chat assistant and calls have no ticket: they hold only model, token counts,
-- cost and latency, no customer data, so they stay writable without one.
ALTER TABLE "ai_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_runs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON "ai_runs";
CREATE POLICY "workspace_isolation" ON "ai_runs"
  USING ("ticket_id" IS NULL OR EXISTS (
    SELECT 1 FROM "tickets" t WHERE t."id" = "ai_runs"."ticket_id"
      AND t."workspace_id" = "app_current_workspace_id"()))
  WITH CHECK ("ticket_id" IS NULL OR EXISTS (
    SELECT 1 FROM "tickets" t WHERE t."id" = "ai_runs"."ticket_id"
      AND t."workspace_id" = "app_current_workspace_id"()));

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON "chat_messages";
CREATE POLICY "workspace_isolation" ON "chat_messages"
  USING (EXISTS (SELECT 1 FROM "chat_sessions" s WHERE s."id" = "chat_messages"."session_id"
                 AND s."workspace_id" = "app_current_workspace_id"()))
  WITH CHECK (EXISTS (SELECT 1 FROM "chat_sessions" s WHERE s."id" = "chat_messages"."session_id"
                      AND s."workspace_id" = "app_current_workspace_id"()));

ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_deliveries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON "webhook_deliveries";
CREATE POLICY "workspace_isolation" ON "webhook_deliveries"
  USING (EXISTS (SELECT 1 FROM "workspace_webhooks" w WHERE w."id" = "webhook_deliveries"."webhook_id"
                 AND w."workspace_id" = "app_current_workspace_id"()))
  WITH CHECK (EXISTS (SELECT 1 FROM "workspace_webhooks" w WHERE w."id" = "webhook_deliveries"."webhook_id"
                      AND w."workspace_id" = "app_current_workspace_id"()));

-- 5. F-12's member-removal trigger updates `users`. It now runs as its owner (SECURITY DEFINER),
--    so removing a member always ends that user's sessions, whatever role or scope deletes the row.
--    The password trigger only changes the row being updated, so it needs nothing.
CREATE OR REPLACE FUNCTION "end_sessions_on_member_removal"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
BEGIN
  UPDATE "users" SET "session_version" = "session_version" + 1 WHERE "id" = OLD."user_id";
  RETURN OLD;
END;
$$;
