-- A call started from a chat joins that conversation (additive only: nullable columns, a
-- constant default, one enum value; no rewrite of existing rows).

-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('CHAT', 'VOICE');

-- AlterEnum
ALTER TYPE "VoiceEndReason" ADD VALUE 'TURN_LIMIT';

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "channel" "ChatChannel" NOT NULL DEFAULT 'CHAT',
ADD COLUMN     "voice_session_id" UUID;

-- AlterTable
ALTER TABLE "voice_sessions" ADD COLUMN     "chat_session_id" UUID;

-- CreateIndex
CREATE INDEX "voice_sessions_chat_session_id_idx" ON "voice_sessions"("chat_session_id");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_voice_session_id_fkey" FOREIGN KEY ("voice_session_id") REFERENCES "voice_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

