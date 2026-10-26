import { CheckResultSchema, FactSchema, type Draft } from '@bookleaf/shared';
import { z } from 'zod';
import { enqueueJob } from '../../ai/jobs/queue.js';
import type { Session } from '../auth/session.js';
import type { TicketDeps } from '../tickets/deps.js';
import { findTicketOrThrow } from '../tickets/repository.js';

const StoredFacts = z.array(FactSchema);

/** Latest stored draft. Opening a ticket never calls the AI: drafts are generated in the background. */
export async function latestDraft(deps: TicketDeps, session: Session, ticketId: string): Promise<{ draft: Draft | null; pending: boolean }> {
  await findTicketOrThrow(deps.db, session, ticketId);
  const [row, openJob] = await Promise.all([
    deps.db.aiDraft.findFirst({ where: { ticketId }, orderBy: [{ generation: 'desc' }, { createdAt: 'desc' }] }),
    deps.db.aiJob.findFirst({ where: { ticketId, status: { in: ['QUEUED', 'RUNNING'] } }, select: { id: true } }),
  ]);
  const pending = openJob !== null;
  if (!row) return { draft: null, pending };
  const draft: Draft = {
    id: row.id,
    generation: row.generation,
    source: row.source,
    body: row.body,
    provider: row.provider,
    model: row.model,
    facts: StoredFacts.parse(row.factsSnapshot),
    check: CheckResultSchema.parse(row.checkResults),
    createdAt: row.createdAt.toISOString(),
  };
  return { draft, pending };
}

export async function regenerateDraft(deps: TicketDeps, session: Session, ticketId: string): Promise<{ draft: Draft | null; pending: boolean }> {
  const ticket = await findTicketOrThrow(deps.db, session, ticketId);
  await enqueueJob(deps.db, ticketId, 'DRAFT', deps.clock.now());
  deps.events.publish({ type: 'ticket.updated', ticketId, authorId: ticket.authorId, authorVisible: false });
  return latestDraft(deps, session, ticketId);
}
