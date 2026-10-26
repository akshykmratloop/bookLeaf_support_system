import type { Prisma } from '@prisma/client';
import { runAiDraft, templateDraft, type DraftResult } from '../../drafting/service.js';
import type { DraftInput } from '../../drafting/types.js';
import { draftInputFromContext } from '../../drafting/from-context.js';
import { DRAFT_PROMPT_VERSION } from '../../prompts/draft.v1.js';
import { loadTicketContext, type TicketContext } from '../context.js';
import { isLatestGeneration } from '../queue.js';
import type { ClaimedJob, JobDeps, JobHandler } from '../types.js';
import { loggedCall } from './logged-call.js';

const draftInput = (ctx: TicketContext, deps: JobDeps): DraftInput => draftInputFromContext(ctx, deps.clock.dataAsOf());

interface Origin {
  provider: string | null;
  model: string | null;
}

async function saveDraft(job: ClaimedJob, deps: JobDeps, ctx: TicketContext, input: DraftInput, draft: DraftResult, origin: Origin) {
  const saved = await deps.db.$transaction(async (tx) => {
    if (!(await isLatestGeneration(tx, job))) return false;
    await tx.aiDraft.create({
      data: {
        ticketId: ctx.ticket.id,
        generation: job.generation,
        source: draft.source,
        body: draft.body,
        provider: origin.provider,
        model: origin.model,
        promptVersion: draft.promptVersion,
        factsSnapshot: input.facts as unknown as Prisma.InputJsonValue,
        claims: draft.claims as unknown as Prisma.InputJsonValue,
        checkResults: draft.check as unknown as Prisma.InputJsonValue,
      },
    });
    if (draft.source === 'TEMPLATE') await tx.ticket.update({ where: { id: ctx.ticket.id }, data: { aiState: 'FALLBACK' } });
    return true;
  });
  if (saved) deps.events.publish({ type: 'ticket.draft_ready', ticketId: ctx.ticket.id, authorId: ctx.ticket.authorId, authorVisible: false });
}

export const draftHandler: JobHandler = {
  async runAi(job, deps) {
    const { provider, model } = await deps.ai.resolve('DRAFT');
    const ctx = await loadTicketContext(deps.db, job.ticketId);
    const input = draftInput(ctx, deps);
    const meta = { ticketId: job.ticketId, task: 'DRAFT' as const, provider, model, promptVersion: DRAFT_PROMPT_VERSION };
    const result = await loggedCall(deps, meta, () => runAiDraft(provider, model, input));
    await saveDraft(job, deps, ctx, input, result.draft, { provider: provider.id, model });
  },
  async fallback(job, deps) {
    const ctx = await loadTicketContext(deps.db, job.ticketId);
    const input = draftInput(ctx, deps);
    await saveDraft(job, deps, ctx, input, templateDraft(input), { provider: null, model: null });
  },
};
