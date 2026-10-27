import type { Prisma } from '@prisma/client';
import { royaltySignals, stageOf } from '../../domain/signals.js';
import { TRIAGE_PROMPT_VERSION } from '../../prompts/triage.v1.js';
import {
  fallbackTriage,
  runAiTriage,
  type TriageDecision,
  type TriageInput,
} from '../../triage/service.js';
import { slaDueAt } from '../../../modules/tickets/sla.js';
import { loadTicketContext, type TicketContext } from '../context.js';
import { enqueueJob, isLatestGeneration } from '../queue.js';
import type { ClaimedJob, JobDeps, JobHandler } from '../types.js';
import { loggedCall } from './logged-call.js';
import { workspaceAiFor } from '../workspace-ai.js';

function triageInput(ctx: TicketContext): TriageInput {
  const bookId = ctx.book?.externalId ?? null;
  return {
    subject: ctx.ticket.subject,
    description: ctx.authorMessages.join('\n\n'),
    bookTitle: ctx.book?.title ?? null,
    bookStage: bookId ? stageOf(ctx.facts, bookId) : null,
    royaltyStatus: royaltySignals(ctx.facts, bookId).bookStatus,
  };
}

/** AI never overwrites a field an admin has set. A triage result always queues a fresh draft. */
async function applyDecision(
  job: ClaimedJob,
  deps: JobDeps,
  ctx: TicketContext,
  d: TriageDecision,
): Promise<void> {
  const t = ctx.ticket;
  const data: Prisma.TicketUpdateInput = {
    priorityReasons: d.priorityReasons,
    needsInfo: d.needsInfo,
    needsReview: d.needsReview,
    aiConfidence: d.source === 'AI' ? d.confidence : null,
    aiState: d.source === 'AI' ? 'DONE' : 'FALLBACK',
    version: { increment: 1 },
  };
  if (t.categorySource !== 'ADMIN' && t.categorySource !== 'AUTHOR')
    Object.assign(data, { category: d.category, categorySource: d.source });
  if (t.prioritySource !== 'ADMIN') {
    Object.assign(data, { priority: d.priority, prioritySource: d.source });
    if (!t.firstResponseAt) data.slaDueAt = slaDueAt(t.createdAt, d.priority);
  }
  const applied = await deps.db.$transaction(async (tx) => {
    if (!(await isLatestGeneration(tx, job))) return false;
    await tx.ticket.update({ where: { id: t.id }, data });
    await enqueueJob(tx, t.id, 'DRAFT', deps.clock.now());
    return true;
  });
  if (applied)
    deps.events.publish({
      type: 'ticket.updated',
      ticketId: t.id,
      workspaceId: t.workspaceId,
      authorId: t.authorId,
      authorVisible: false,
    });
}

export const triageHandler: JobHandler = {
  async runAi(job, deps) {
    const { triageModel, workspaceId } = await workspaceAiFor(deps.db, job.ticketId);
    const { provider, model } = await deps.ai.resolve('TRIAGE', {
      workspaceId,
      preferred: triageModel,
    });
    const ctx = await loadTicketContext(deps, job.ticketId);
    const meta = {
      ticketId: job.ticketId,
      task: 'TRIAGE' as const,
      provider,
      model,
      promptVersion: TRIAGE_PROMPT_VERSION,
    };
    const result = await loggedCall(deps, meta, () =>
      runAiTriage(provider, model, triageInput(ctx)),
    );
    await applyDecision(job, deps, ctx, result.decision);
  },
  async fallback(job, deps) {
    const ctx = await loadTicketContext(deps, job.ticketId);
    await applyDecision(job, deps, ctx, fallbackTriage(triageInput(ctx)));
  },
};
