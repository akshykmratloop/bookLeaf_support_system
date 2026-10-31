import { z } from 'zod';
import { flag, int, optionalSecret } from './fields.js';

/** Text AI (triage, reply drafts, chat) and the background worker that runs it. */
export const AiConfig = z.object({
  /** Leave empty to run on the rule-based fallback. */
  ANTHROPIC_API_KEY: optionalSecret(),
  /** Business clock: payout maths runs "as of" this date. */
  DATA_AS_OF: z.iso.date().default('2025-12-31'),
  WORKER_ENABLED: flag('true'),
  WORKER_POLL_MS: int(100, 60_000, 1000),
  /** Claim loops per process: jobs run side by side (each holds its own lease). */
  WORKER_CONCURRENCY: int(1, 8, 2),
  /** Most AI runs one workspace may make in 24 h; ticket jobs then fall back (AI_BUDGET). */
  AI_TICKET_RUNS_PER_WORKSPACE_PER_DAY: int(1, 1_000_000, 2000),
});
