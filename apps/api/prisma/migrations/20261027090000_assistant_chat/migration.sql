-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('PORTAL', 'CHAT', 'VOICE');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('AUTHOR', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ChatAnswerSource" AS ENUM ('AI', 'SAFE_FALLBACK', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "chat_session_id" UUID,
ADD COLUMN     "source" "TicketSource" NOT NULL DEFAULT 'PORTAL';

-- CreateTable
CREATE TABLE "assistant_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "chat_enabled" BOOLEAN NOT NULL DEFAULT false,
    "voice_enabled" BOOLEAN NOT NULL DEFAULT false,
    "chat_model" TEXT NOT NULL DEFAULT 'claude-haiku-5-5',
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assistant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "ChatRole" NOT NULL,
    "body" TEXT NOT NULL,
    "source" "ChatAnswerSource",
    "facts_used" JSONB NOT NULL DEFAULT '[]',
    "check" JSONB,
    "proposal" JSONB,
    "model" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_sessions_author_id_created_at_idx" ON "chat_sessions"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_chat_session_id_key" ON "tickets"("chat_session_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the singleton settings row: both author features start switched OFF.
INSERT INTO "assistant_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
