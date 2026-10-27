-- CreateEnum
CREATE TYPE "TicketDraftStatus" AS ENUM ('OPEN', 'AWAITING_CONFIRMATION', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "DraftEditor" AS ENUM ('AUTHOR', 'ASSISTANT');

-- AlterEnum
ALTER TYPE "FieldSource" ADD VALUE 'AUTHOR';

-- AlterTable
ALTER TABLE "voice_sessions" ADD COLUMN     "thread_id" UUID;

-- CreateTable
CREATE TABLE "ticket_drafts" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "chat_session_id" UUID,
    "voice_thread_id" UUID,
    "category" "TicketCategory",
    "book_id" UUID,
    "subject" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "TicketDraftStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "last_edited_by" "DraftEditor" NOT NULL DEFAULT 'ASSISTANT',
    "ticket_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ticket_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_drafts_chat_session_id_key" ON "ticket_drafts"("chat_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_drafts_voice_thread_id_key" ON "ticket_drafts"("voice_thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_drafts_ticket_id_key" ON "ticket_drafts"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_drafts_author_id_idx" ON "ticket_drafts"("author_id");

-- CreateIndex
CREATE INDEX "voice_sessions_thread_id_idx" ON "voice_sessions"("thread_id");

-- AddForeignKey
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A draft belongs to exactly one chat conversation or one call thread (hand-written; Prisma does not model CHECKs).
ALTER TABLE "ticket_drafts" ADD CONSTRAINT "ticket_drafts_one_owner_check" CHECK (num_nonnulls("chat_session_id", "voice_thread_id") = 1);
