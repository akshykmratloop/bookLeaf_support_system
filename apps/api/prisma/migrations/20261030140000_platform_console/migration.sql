-- U-7: the support provider's super admin console, and the split between platform settings
-- (shared, hidden from customers) and customer settings (per workspace, under RLS).
--
-- Expand step only (CLAUDE.md §17): nothing is dropped or renamed. The legacy singletons
-- ai_settings / assistant_settings, the workspace_settings model columns and
-- workspace_provider_keys stay in place but are no longer read or written; a later release
-- drops them. New columns are nullable or carry constant defaults (metadata-only on PG 11+).
--
-- Platform tables (platform_admins, platform_settings, platform_provider_keys, workspace_plans)
-- are for the owner connection only: section 6 removes every grant the restricted app role got
-- from the schema's default privileges, and RLS with no policy denies it every row as a second
-- lock. `node dist/db-roles.js` revokes them again on each deploy.
-- Rollback: the old code ignores every new table and column; restore the pre-deploy backup only
-- if the new rows must go too.

-- 1. Customer AI behaviour and widget settings.
-- CreateEnum
CREATE TYPE "ReplyLanguage" AS ENUM ('ENGLISH', 'HINGLISH', 'MATCH');

-- CreateEnum
CREATE TYPE "ReplyLength" AS ENUM ('SHORT', 'MEDIUM', 'DETAILED');

-- CreateEnum
CREATE TYPE "ReplyFormality" AS ENUM ('FORMAL', 'NEUTRAL', 'FRIENDLY');

-- CreateEnum
CREATE TYPE "WidgetTheme" AS ENUM ('AUTO', 'LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "ai_runs" ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "workspace_settings" ADD COLUMN     "formality" "ReplyFormality",
ADD COLUMN     "greeting" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "launcher_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "reply_language" "ReplyLanguage",
ADD COLUMN     "reply_length" "ReplyLength",
ADD COLUMN     "signature" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "topics_to_avoid" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "widget_theme" "WidgetTheme" NOT NULL DEFAULT 'AUTO';

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "session_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL,
    "triage_model" TEXT NOT NULL,
    "draft_model" TEXT NOT NULL,
    "chat_model" TEXT NOT NULL,
    "voice_model" TEXT,
    "simulate_outage" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_provider_keys" (
    "id" UUID NOT NULL,
    "capability" "ProviderCapability" NOT NULL,
    "provider" TEXT NOT NULL,
    "key_enc" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_provider_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_plans" (
    "workspace_id" UUID NOT NULL,
    "chat_allowed" BOOLEAN NOT NULL DEFAULT true,
    "voice_allowed" BOOLEAN NOT NULL DEFAULT true,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_messages_per_minute" INTEGER NOT NULL DEFAULT 120,
    "max_messages_per_day" INTEGER NOT NULL DEFAULT 2000,
    "max_turns_per_session" INTEGER NOT NULL DEFAULT 200,
    "max_calls_per_hour" INTEGER NOT NULL DEFAULT 60,
    "max_calls_per_day" INTEGER NOT NULL DEFAULT 200,
    "max_call_seconds" INTEGER NOT NULL DEFAULT 300,
    "suspended_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspace_plans_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provider_keys_capability_provider_key" ON "platform_provider_keys"("capability", "provider");

-- CreateIndex
CREATE INDEX "ai_runs_workspace_id_created_at_idx" ON "ai_runs"("workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_plans" ADD CONSTRAINT "workspace_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 2. The platform defaults are today's shared settings. BookLeaf (the default workspace) had
--    chosen its own models on top of them; those win, so BookLeaf behaves exactly as before.
--    Other workspaces' model choices are kept in their (now unread) columns.
INSERT INTO "platform_settings"
  ("id", "provider", "triage_model", "draft_model", "chat_model", "simulate_outage", "version", "updated_at")
SELECT 1,
       COALESCE(a."provider", 'anthropic'),
       COALESCE(w."triage_model", a."triage_model", 'claude-haiku-5-5'),
       COALESCE(w."draft_model", a."draft_model", 'claude-sonnet-5-5'),
       COALESCE(w."chat_model", s."chat_model", 'claude-haiku-5-5'),
       COALESCE(a."simulate_outage", false),
       0,
       CURRENT_TIMESTAMP
FROM (SELECT 1) AS one
LEFT JOIN "ai_settings" a ON a."id" = 1
LEFT JOIN "assistant_settings" s ON s."id" = 1
LEFT JOIN "workspace_settings" w
  ON w."workspace_id" = (SELECT "id" FROM "workspaces" WHERE "is_default" LIMIT 1)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_singleton" CHECK ("id" = 1);

-- 3. Every existing customer gets a plan that allows what it has today (chat, voice, AI and the
--    widest limits the settings screen ever accepted), so nothing changes until a super admin
--    lowers it.
INSERT INTO "workspace_plans" ("workspace_id", "updated_at")
SELECT "id", CURRENT_TIMESTAMP FROM "workspaces"
ON CONFLICT ("workspace_id") DO NOTHING;

-- 4. A workspace without its own settings row used to take its chat/voice switches from the
--    assistant_settings singleton on first read. New rows now start switched off, so a workspace
--    that relied on a switched-on singleton gets its own row with those switches now.
INSERT INTO "workspace_settings" ("id", "workspace_id", "chat_enabled", "voice_enabled", "brand_color", "updated_at")
SELECT gen_random_uuid(), w."id", s."chat_enabled", s."voice_enabled", '#d13f53', CURRENT_TIMESTAMP
FROM "workspaces" w
JOIN "assistant_settings" s ON s."id" = 1 AND (s."chat_enabled" OR s."voice_enabled")
WHERE NOT EXISTS (SELECT 1 FROM "workspace_settings" x WHERE x."workspace_id" = w."id");

-- 5. AI runs name their customer from now on (usage and cost per customer). Older runs of a
--    ticket get its workspace; older chat and call runs have no ticket and stay unattributed.
UPDATE "ai_runs" r SET "workspace_id" = t."workspace_id"
FROM "tickets" t
WHERE r."ticket_id" = t."id" AND r."workspace_id" IS NULL;

DROP POLICY IF EXISTS "workspace_isolation" ON "ai_runs";
CREATE POLICY "workspace_isolation" ON "ai_runs"
  USING (("workspace_id" IS NULL OR "workspace_id" = "app_current_workspace_id"())
    AND ("ticket_id" IS NULL OR EXISTS (
      SELECT 1 FROM "tickets" t WHERE t."id" = "ai_runs"."ticket_id"
        AND t."workspace_id" = "app_current_workspace_id"())))
  WITH CHECK (("workspace_id" IS NULL OR "workspace_id" = "app_current_workspace_id"())
    AND ("ticket_id" IS NULL OR EXISTS (
      SELECT 1 FROM "tickets" t WHERE t."id" = "ai_runs"."ticket_id"
        AND t."workspace_id" = "app_current_workspace_id"())));

-- 6. Platform tables: owner only. Remove the grants any other role received through default
--    privileges, then deny every row to anyone that cannot bypass RLS (no policy = no rows).
DO $$
DECLARE
  grantee_name text;
BEGIN
  FOR grantee_name IN
    SELECT DISTINCT grantee FROM information_schema.role_table_grants
    WHERE table_schema = current_schema()
      AND table_name IN ('platform_admins', 'platform_settings', 'platform_provider_keys', 'workspace_plans')
      AND grantee NOT IN (current_user, 'PUBLIC')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON "platform_admins", "platform_settings", "platform_provider_keys", "workspace_plans" FROM %I',
      grantee_name
    );
  END LOOP;
END
$$;
REVOKE ALL ON "platform_admins", "platform_settings", "platform_provider_keys", "workspace_plans" FROM PUBLIC;

ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_admins" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "platform_provider_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_provider_keys" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workspace_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_plans" FORCE ROW LEVEL SECURITY;
