-- H-AI: a terminal FAILED state for AI jobs whose rules fallback itself threw (a poison job).
-- Additive only: one new enum value; no existing row changes. FAILED jobs are never reclaimed.
ALTER TYPE "AiJobStatus" ADD VALUE IF NOT EXISTS 'FAILED';
