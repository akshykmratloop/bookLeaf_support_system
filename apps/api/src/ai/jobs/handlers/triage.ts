import type { Prisma } from '@prisma/client';
import { royaltySignals, stageOf } from '../../domain/signals.js';
import { TRIAGE_PROMPT_VERSION } from '../../prompts/triage.v1.js';
import { triageHistory } from '../../prompts/history.js';
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
import { assertWithinBudget } from '../budget.js';
import { categoryOf } from '../../knowledge/knowledge.js';

function triageInput(ctx: TicketContext): TriageInput {
  const bookId = ctx.book?.externalId ?? null;
  return {
    subject: ctx.ticket.subject,
    description: triageHistory(ctx.authorMessages),
    bookTitle: ctx.book?.title ?? null,
    bookStage: bookId ? stageOf(ctx.facts, bookId) : null,
    royaltyStatus: royaltySignals(ctx.facts, bookId).bookStatus,
  };
}

/** The category after a decision: an admin's or author's choice stays. */
function categoryAfter(t: TicketContext['ticket'], d: TriageDecision) {
  const keep = t.categorySource === 'ADMIN' || t.categorySource === 'AUTHOR';
  return { keep, key: keep ? t.categoryKey : (d.category ?? t.categoryKey) };
}

/**
 * The category and priority part of a decision, leaving whatever an admin or author chose. The
 * first-response deadline follows the ticket's category and priority afterwards (S.9): it moves
 * when either changes, so a new category's hours apply even when an admin set the priority.
 */
function fieldChanges(ctx: TicketContext, d: TriageDecision): Prisma.TicketUncheckedUpdateInput {
  const t = ctx.ticket;
  const category = categoryAfter(t, d);
  const keepPriority = t.prioritySource === 'ADMIN';
  const data: Prisma.TicketUncheckedUpdateInput = {};
  if (!category.keep && d.category)
    Object.assign(data, { categoryKey: d.category, categorySource: d.source });
  if (!keepPriority) Object.assign(data, { priority: d.priority, prioritySource: d.source });
  const slaMoves = !keepPriority || category.key !== t.categoryKey;
  if (slaMoves && !t.firstResponseAt) {
    const priority = keepPriority ? t.priority : d.priority;
    const categorySla = categoryOf(ctx.knowledge, category.key)?.slaHours;
    data.slaDueAt = slaDueAt(t.createdAt, priority, categorySla);
  }
  return data;
}

/** AI never overwrites a field an admin has set. A triage result always queues a fresh draft. */
async function applyDecision(
  job: ClaimedJob,
  deps: JobDeps,
  ctx: TicketContext,
  d: TriageDecision,
): Promise<void> {
  const t = ctx.ticket;
  const data: Prisma.TicketUncheckedUpdateInput = {
    priorityReasons: d.priorityReasons,
    needsInfo: d.needsInfo,
    needsReview: d.needsReview,
    aiConfidence: d.source === 'AI' ? d.confidence : null,
    aiState: d.source === 'AI' ? 'DONE' : 'FALLBACK',
    version: { increment: 1 },
    ...fieldChanges(ctx, d),
  };
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
    const ctx = await loadTicketContext(deps, job.ticketId);
    await assertWithinBudget(deps, ctx.ticket.workspaceId);
    const { provider, model, providerId } = await deps.ai.resolve('TRIAGE', {
      workspaceId: ctx.ticket.workspaceId,
    });
    const meta = {
      ticketId: job.ticketId,
      workspaceId: ctx.ticket.workspaceId,
      task: 'TRIAGE' as const,
      provider,
      providerId,
      model,
      promptVersion: TRIAGE_PROMPT_VERSION,
    };
    const result = await loggedCall(deps, meta, () =>
      runAiTriage(provider, model, triageInput(ctx), ctx.knowledge),
    );
    await applyDecision(job, deps, ctx, result.decision);
  },
  async fallback(job, deps) {
    const ctx = await loadTicketContext(deps, job.ticketId);
    await applyDecision(job, deps, ctx, fallbackTriage(triageInput(ctx), ctx.knowledge));
  },
};
