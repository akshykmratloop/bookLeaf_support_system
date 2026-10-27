-- Multi-tenant foundation (expand → backfill → contract, in one migration):
-- 1. create the workspace tables;
-- 2. insert the default workspace ("bookleaf", a fixed id used by the seed and the env fallback);
-- 3. add workspace_id to every tenant-owned table as nullable, backfill every row to the default
--    workspace, then make it required;
-- 4. move the unique keys on users.email, authors.external_id and books.external_id under the
--    workspace. Safe on an empty database and on a populated one; the insert is idempotent.

CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "CustomerFieldType" AS ENUM ('MONEY', 'DATE', 'TEXT', 'STATUS', 'NUMBER');

-- DropIndex
DROP INDEX "authors_external_id_key";

-- DropIndex
DROP INDEX "books_external_id_key";

-- DropIndex
DROP INDEX "users_email_key";

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- The default workspace: today's single-tenant BookLeaf setup, driven by env.
INSERT INTO "workspaces" ("id", "slug", "name", "is_default", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000001', 'bookleaf', 'BookLeaf Publishing', true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "authors" ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "books" ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "ticket_drafts" ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "voice_sessions" ADD COLUMN     "workspace_id" UUID;

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_connectors" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "base_url" TEXT NOT NULL,
    "sign_in_url" TEXT,
    "api_key_enc" TEXT NOT NULL,
    "api_key_hint" TEXT NOT NULL,
    "signing_secret_enc" TEXT NOT NULL,
    "signing_secret_hint" TEXT NOT NULL,
    "timeout_ms" INTEGER NOT NULL DEFAULT 3000,
    "cache_seconds" INTEGER NOT NULL DEFAULT 60,
    "last_test_at" TIMESTAMPTZ(3),
    "last_test_ok" BOOLEAN,
    "last_test_detail" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspace_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_fields" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomerFieldType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "allowed_values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visible_to_customer" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_settings" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "triage_model" TEXT,
    "draft_model" TEXT,
    "chat_model" TEXT,
    "tone_guide" TEXT NOT NULL DEFAULT '',
    "chat_enabled" BOOLEAN NOT NULL DEFAULT false,
    "messages_per_minute" INTEGER NOT NULL DEFAULT 20,
    "messages_per_day" INTEGER NOT NULL DEFAULT 100,
    "max_turns_per_session" INTEGER NOT NULL DEFAULT 30,
    "voice_enabled" BOOLEAN NOT NULL DEFAULT false,
    "voice_name" TEXT NOT NULL DEFAULT 'marin',
    "max_call_seconds" INTEGER NOT NULL DEFAULT 300,
    "calls_per_hour" INTEGER NOT NULL DEFAULT 5,
    "calls_per_day" INTEGER NOT NULL DEFAULT 10,
    "allowed_origins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brand_name" TEXT NOT NULL DEFAULT '',
    "brand_color" TEXT NOT NULL DEFAULT '#2f6b4f',
    "customer_noun" TEXT NOT NULL DEFAULT 'customer',
    "item_noun" TEXT NOT NULL DEFAULT 'item',
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_api_keys" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_connectors_workspace_id_key" ON "workspace_connectors"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_fields_workspace_id_key_key" ON "customer_fields"("workspace_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_settings_workspace_id_key" ON "workspace_settings"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_api_keys_key_hash_key" ON "workspace_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "workspace_api_keys_workspace_id_idx" ON "workspace_api_keys"("workspace_id");

-- CreateIndex
CREATE INDEX "audit_events_workspace_id_created_at_idx" ON "audit_events"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "authors_workspace_id_external_id_key" ON "authors"("workspace_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "books_workspace_id_external_id_key" ON "books"("workspace_id", "external_id");

-- CreateIndex
CREATE INDEX "tickets_workspace_id_status_priority_sla_due_at_idx" ON "tickets"("workspace_id", "status", "priority", "sla_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_workspace_id_email_key" ON "users"("workspace_id", "email");

-- Backfill every existing row to the default workspace, then require the column.
UPDATE "users" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "authors" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "books" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "tickets" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "chat_sessions" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "voice_sessions" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "ticket_drafts" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
UPDATE "audit_events" SET "workspace_id" = '00000000-0000-4000-8000-000000000001' WHERE "workspace_id" IS NULL;
ALTER TABLE "users" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "authors" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "books" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "tickets" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "chat_sessions" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "voice_sessions" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "ticket_drafts" ALTER COLUMN "workspace_id" SET NOT NULL;

-- Every seeded admin becomes an OWNER of the default workspace.
INSERT INTO "workspace_members" ("id", "workspace_id", "user_id", "role")
SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000001', u."id", 'OWNER'
FROM "users" u WHERE u."role" = 'ADMIN'
ON CONFLICT ("workspace_id", "user_id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_connectors" ADD CONSTRAINT "workspace_connectors_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_fields" ADD CONSTRAINT "customer_fields_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_api_keys" ADD CONSTRAINT "workspace_api_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authors" ADD CONSTRAINT "authors_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

