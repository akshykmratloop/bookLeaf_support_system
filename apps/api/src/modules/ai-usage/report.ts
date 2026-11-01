import { AI_USAGE_FEATURES, type AiUsage } from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { USAGE_DAYS } from '../platform/usage.js';
import { summarizeUsage } from './summary.js';

export interface UsageReportDeps {
  db: Db;
  clock: Clock;
}

const DAY_MS = 86_400_000;

/**
 * One workspace's AI cost over the last USAGE_DAYS days: two grouped queries, counts and sums
 * only. Always filtered by the workspace id, so it is correct on the owner connection (console)
 * as well as under row-level security (the workspace's own admin).
 */
export async function usageReport(deps: UsageReportDeps, workspaceId: string): Promise<AiUsage> {
  const since = new Date(deps.clock.now().getTime() - USAGE_DAYS * DAY_MS);
  const where = { workspaceId, createdAt: { gte: since } };
  const [runs, calls] = await Promise.all([
    deps.db.aiRun.groupBy({
      by: ['task', 'outcome'],
      where: { ...where, task: { in: [...AI_USAGE_FEATURES] } },
      _count: { _all: true },
      _sum: { costMicros: true },
    }),
    deps.db.voiceSession.aggregate({ where, _sum: { durationSeconds: true } }),
  ]);
  return summarizeUsage({
    runs: runs.map((r) => ({
      task: r.task,
      outcome: r.outcome,
      count: r._count._all,
      costMicros: r._sum.costMicros ?? 0,
    })),
    callSeconds: calls._sum.durationSeconds ?? 0,
    days: USAGE_DAYS,
    since,
  });
}
