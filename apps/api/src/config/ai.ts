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
});
