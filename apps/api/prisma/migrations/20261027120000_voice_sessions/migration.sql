-- CreateEnum
CREATE TYPE "VoiceCallStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VoiceEndReason" AS ENUM ('USER_HANGUP', 'TIME_LIMIT', 'ASSISTANT_ENDED', 'IDLE', 'DISCONNECTED', 'DISABLED_BY_ADMIN', 'PROVIDER_ERROR', 'SERVER_RESTART');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "voice_session_id" UUID;

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "status" "VoiceCallStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "max_seconds" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" "VoiceEndReason",
    "duration_seconds" INTEGER,
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "proposal" JSONB,
    "spoken_check" JSONB,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_sessions_author_id_created_at_idx" ON "voice_sessions"("author_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_voice_session_id_key" ON "tickets"("voice_session_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_voice_session_id_fkey" FOREIGN KEY ("voice_session_id") REFERENCES "voice_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

