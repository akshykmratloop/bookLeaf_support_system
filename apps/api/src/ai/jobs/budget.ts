import { AiBudgetExceededError } from '../providers/errors.js';
import type { JobDeps } from './types.js';

/** AI_TICKET_RUNS_PER_WORKSPACE_PER_DAY's default. */
export const DEFAULT_TICKET_RUNS_PER_DAY = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Stops a runaway workspace from spending without limit: at or over its AI runs in the last
 * 24 h, a ticket job falls back to rules (AI_BUDGET) without calling the model.
 */
export async function assertWithinBudget(deps: JobDeps, workspaceId: string): Promise<void> {
  const cap = deps.ticketRunsPerWorkspacePerDay ?? DEFAULT_TICKET_RUNS_PER_DAY;
  const since = new Date(deps.clock.now().getTime() - DAY_MS);
  const used = await deps.db.aiRun.count({ where: { workspaceId, createdAt: { gte: since } } });
  if (used >= cap)
    throw new AiBudgetExceededError(`Workspace made ${used} AI runs in 24 h (cap ${cap})`);
}
