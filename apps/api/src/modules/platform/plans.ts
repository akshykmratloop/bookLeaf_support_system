import { DEFAULT_PLAN, type Plan } from '@bookleaf/shared';
import type { WorkspacePlan } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';

/** A customer's plan as the rest of the app uses it, plus whether it is suspended. */
export interface PlanState {
  plan: Plan;
  suspended: boolean;
  version: number;
}

export function toPlan(row: WorkspacePlan | null): Plan {
  if (!row) return DEFAULT_PLAN;
  return {
    chatAllowed: row.chatAllowed,
    voiceAllowed: row.voiceAllowed,
    aiEnabled: row.aiEnabled,
    max: {
      messagesPerMinute: row.maxMessagesPerMinute,
      messagesPerDay: row.maxMessagesPerDay,
      maxTurnsPerSession: row.maxTurnsPerSession,
      callsPerHour: row.maxCallsPerHour,
      callsPerDay: row.maxCallsPerDay,
      maxCallSeconds: row.maxCallSeconds,
    },
  };
}

export const toPlanState = (row: WorkspacePlan | null): PlanState => ({
  plan: toPlan(row),
  suspended: row?.suspendedAt != null,
  version: row?.version ?? 0,
});

/** Read on the owner connection: the app role has no grant on workspace_plans (U-7). */
export const readPlan = (db: Db, workspaceId: string) =>
  asPlatform(() => db.workspacePlan.findUnique({ where: { workspaceId } }));

/** Short enough that another server instance sees a change within seconds. */
const CACHE_MS = 5_000;

/** Every customer's plan through a short cache that the console clears on save (shared, F-19). */
export function createPlanReader(db: Db, now = Date.now) {
  const cache = new Map<string, { at: number; state: Promise<PlanState> }>();
  return {
    forWorkspace(workspaceId: string): Promise<PlanState> {
      const hit = cache.get(workspaceId);
      if (hit && now() - hit.at < CACHE_MS) return hit.state;
      const state = readPlan(db, workspaceId).then(toPlanState);
      cache.set(workspaceId, { at: now(), state });
      state.catch(() => cache.delete(workspaceId));
      return state;
    },
    invalidate(workspaceId: string) {
      if (workspaceId) cache.delete(workspaceId);
      else cache.clear();
    },
  };
}

export type PlanReader = ReturnType<typeof createPlanReader>;
