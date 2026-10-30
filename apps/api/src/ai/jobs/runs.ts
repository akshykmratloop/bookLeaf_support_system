import type { Db } from '../../platform/db.js';
import { estimateCostMicros, findModel } from '../providers/catalog.js';
import type { Usage } from '../providers/types.js';

export interface RunRecord {
  ticketId: string | null;
  /** The customer the call was for (usage and cost per customer, U-7). */
  workspaceId: string | null;
  task: string;
  provider: string;
  model: string;
  promptVersion: string | null;
  usage: Usage | null;
  latencyMs: number;
  errorCode: string | null;
}

/** Every AI attempt (success or failure) is recorded: tokens, cost estimate, latency, outcome. */
export async function recordRun(db: Db, r: RunRecord): Promise<void> {
  const usage = r.usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  await db.aiRun.create({
    data: {
      ticketId: r.ticketId,
      workspaceId: r.workspaceId,
      task: r.task,
      provider: r.provider,
      model: r.model,
      promptVersion: r.promptVersion,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      costMicros: r.usage ? estimateCostMicros(findModel(r.provider, r.model), usage) : null,
      latencyMs: r.latencyMs,
      outcome: r.errorCode ? 'ERROR' : 'OK',
      errorCode: r.errorCode,
    },
  });
}
