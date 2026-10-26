import { AiError } from '../../providers/errors.js';
import type { LlmProvider, StructuredResult } from '../../providers/types.js';
import { recordRun } from '../runs.js';
import type { JobDeps } from '../types.js';

interface CallMeta {
  ticketId: string;
  task: 'TRIAGE' | 'DRAFT';
  provider: LlmProvider;
  model: string;
  promptVersion: string;
}

type RunInfo = Omit<StructuredResult<unknown>, 'data'>;

/** Wraps one AI call so every attempt lands in ai_runs, including failures. */
export async function loggedCall<T extends { run: RunInfo }>(deps: JobDeps, meta: CallMeta, call: () => Promise<T>): Promise<T> {
  const started = deps.clock.now().getTime();
  const base = { ticketId: meta.ticketId, task: meta.task, provider: meta.provider.id, model: meta.model, promptVersion: meta.promptVersion };
  try {
    const result = await call();
    await recordRun(deps.db, { ...base, usage: result.run.usage, latencyMs: result.run.latencyMs, errorCode: null });
    return result;
  } catch (err) {
    const errorCode = err instanceof AiError ? err.code : 'INTERNAL';
    await recordRun(deps.db, { ...base, usage: null, latencyMs: deps.clock.now().getTime() - started, errorCode });
    throw err;
  }
}
