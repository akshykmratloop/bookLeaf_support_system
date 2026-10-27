import type { TicketDraft } from '@bookleaf/shared';
import { ValidationError } from '../../platform/errors.js';
import { draftChanged, draftSent, type DraftDeps } from './deps.js';
import { isDraftComplete, toTicketDraft } from './mappers.js';
import { findOwnDraft } from './repository.js';

/** The assistant read the draft back and asked "shall I send it?". */
export async function requestConfirmation(
  deps: DraftDeps,
  authorId: string,
  id: string,
): Promise<TicketDraft> {
  const current = await findOwnDraft(deps.db, id, authorId);
  if (current.status === 'SUBMITTED') throw draftSent();
  if (!isDraftComplete(current))
    throw new ValidationError('The draft needs a subject and a description first.');
  // Only the version the assistant read back: an edit made meanwhile cancels the request.
  const res = await deps.db.ticketDraft.updateMany({
    where: { id, version: current.version, status: { not: 'SUBMITTED' } },
    data: { status: 'AWAITING_CONFIRMATION' },
  });
  if (res.count !== 1) throw draftChanged();
  const draft = toTicketDraft(await findOwnDraft(deps.db, id, authorId));
  deps.live.publish({ draft, by: 'ASSISTANT', changed: ['status'] });
  return draft;
}
