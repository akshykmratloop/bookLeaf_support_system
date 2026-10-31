import type { PlatformAiStatus } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';

const WINDOW_MINUTES = 60;
/** Error codes that mean the key or the provider setup is wrong, not a passing blip. */
const SETUP_CODES = new Set(['AI_AUTH', 'AI_NOT_CONFIGURED']);

/**
 * AI jobs of every customer that ended in the rules fallback or FAILED in the last hour, so an
 * expired key or a missing provider shows on the console instead of only in the logs.
 */
export async function recentAiJobOutcomes(
  db: Db,
  now: Date,
): Promise<PlatformAiStatus['recentJobs']> {
  const since = new Date(now.getTime() - WINDOW_MINUTES * 60_000);
  const groups = await asPlatform(() =>
    db.aiJob.groupBy({
      by: ['status', 'lastErrorCode'],
      where: { status: { in: ['FALLBACK', 'FAILED'] }, finishedAt: { gte: since } },
      _count: { _all: true },
    }),
  );
  const sum = (keep: (g: (typeof groups)[number]) => boolean) =>
    groups.filter(keep).reduce((n, g) => n + g._count._all, 0);
  return {
    windowMinutes: WINDOW_MINUTES,
    fallback: sum((g) => g.status === 'FALLBACK'),
    failed: sum((g) => g.status === 'FAILED'),
    authOrNotConfigured: sum((g) => SETUP_CODES.has(g.lastErrorCode ?? '')),
  };
}
