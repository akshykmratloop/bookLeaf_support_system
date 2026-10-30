import type { CustomerUsage } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';

/** The window the "recent" usage figures cover. */
export const USAGE_DAYS = 30;

type Counts = Map<string, number>;
const byWorkspace = <R extends { workspaceId: string | null }>(
  rows: R[],
  value: (r: R) => number,
) => new Map(rows.flatMap((r) => (r.workspaceId ? [[r.workspaceId, value(r)] as const] : [])));

/**
 * Usage per customer, as counts and sums only (U-7): one grouped query per table for every
 * customer at once, never a row's content. Runs on the owner connection (platform scope).
 */
export async function usageByWorkspace(db: Db, since: Date) {
  const recent = { createdAt: { gte: since } };
  const [tickets, ticketsRecent, chats, calls, runs] = await Promise.all([
    db.ticket.groupBy({ by: ['workspaceId'], _count: { _all: true } }),
    db.ticket.groupBy({ by: ['workspaceId'], where: recent, _count: { _all: true } }),
    db.chatSession.groupBy({ by: ['workspaceId'], where: recent, _count: { _all: true } }),
    db.voiceSession.groupBy({
      by: ['workspaceId'],
      where: recent,
      _count: { _all: true },
      _sum: { durationSeconds: true },
    }),
    db.aiRun.groupBy({
      by: ['workspaceId'],
      where: recent,
      _count: { _all: true },
      _sum: { costMicros: true },
    }),
  ]);
  const maps = {
    tickets: byWorkspace(tickets, (r) => r._count._all),
    ticketsRecent: byWorkspace(ticketsRecent, (r) => r._count._all),
    conversations: byWorkspace(chats, (r) => r._count._all),
    calls: byWorkspace(calls, (r) => r._count._all),
    callMinutes: byWorkspace(calls, (r) => Math.round((r._sum.durationSeconds ?? 0) / 60)),
    aiRuns: byWorkspace(runs, (r) => r._count._all),
    aiCostMicros: byWorkspace(runs, (r) => r._sum.costMicros ?? 0),
  } satisfies Record<keyof CustomerUsage, Counts>;
  return (workspaceId: string): CustomerUsage => ({
    tickets: maps.tickets.get(workspaceId) ?? 0,
    ticketsRecent: maps.ticketsRecent.get(workspaceId) ?? 0,
    conversations: maps.conversations.get(workspaceId) ?? 0,
    calls: maps.calls.get(workspaceId) ?? 0,
    callMinutes: maps.callMinutes.get(workspaceId) ?? 0,
    aiRuns: maps.aiRuns.get(workspaceId) ?? 0,
    aiCostMicros: maps.aiCostMicros.get(workspaceId) ?? 0,
  });
}
