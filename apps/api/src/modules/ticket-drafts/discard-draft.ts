import type { TicketDraft } from '@bookleaf/shared';
import { draftChanged, draftSent, type DraftDeps } from './deps.js';
import { toTicketDraft } from './mappers.js';
import { findOwnDraft } from './repository.js';

const EMPTY = { categoryKey: null, bookId: null, subject: '', description: '' } as const;

/**
 * The author threw the draft away. It is emptied, not deleted: a live call and the chat keep
 * pointing at the same draft, so the assistant can start a new one in place.
 */
export async function discardDraft(
  deps: DraftDeps,
  authorId: string,
  { id, version }: { id: string; version: number },
): Promise<TicketDraft> {
  const current = await findOwnDraft(deps.db, id, authorId);
  if (current.status === 'SUBMITTED') throw draftSent();
  // Only the version the author saw, and never once sent: both re-checked in the same write.
  const res = await deps.db.ticketDraft.updateMany({
    where: { id, authorId, version, status: { not: 'SUBMITTED' } },
    data: { ...EMPTY, status: 'OPEN', version: { increment: 1 }, lastEditedBy: 'AUTHOR' },
  });
  if (res.count !== 1) {
    const now = await findOwnDraft(deps.db, id, authorId);
    throw now.status === 'SUBMITTED' ? draftSent() : draftChanged();
  }
  const draft = toTicketDraft(await findOwnDraft(deps.db, id, authorId));
  deps.live.publish({
    draft,
    by: 'AUTHOR',
    changed: ['category', 'bookId', 'subject', 'description', 'status'],
    discarded: true,
  });
  return draft;
}
