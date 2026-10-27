import type { DraftEditor, TicketDraft } from '@bookleaf/shared';
import { ValidationError } from '../../platform/errors.js';
import { draftSent, type DraftDeps, type DraftPatch } from './deps.js';
import { toTicketDraft } from './mappers.js';
import { findOwnDraft } from './repository.js';

type Field = 'category' | 'bookId' | 'subject' | 'description';
const FIELDS: Field[] = ['category', 'bookId', 'subject', 'description'];

export interface DraftEdit {
  id: string;
  patch: DraftPatch;
  by: DraftEditor;
}

async function assertOwnBook(deps: DraftDeps, authorId: string, bookId: string | null | undefined) {
  if (!bookId) return;
  if (!(await deps.db.book.count({ where: { id: bookId, authorId } })))
    throw new ValidationError('Choose one of your own books.', [
      { path: 'bookId', message: 'Not one of your books' },
    ]);
}

/** Field-level edit. Any change resets a pending confirmation: confirm only what was seen. */
export async function editDraft(
  deps: DraftDeps,
  authorId: string,
  { id, patch, by }: DraftEdit,
): Promise<TicketDraft> {
  const current = await findOwnDraft(deps.db, id, authorId);
  if (current.status === 'SUBMITTED') throw draftSent();
  await assertOwnBook(deps, authorId, patch.bookId);
  const changed = FIELDS.filter((f) => patch[f] !== undefined && patch[f] !== current[f]);
  if (changed.length === 0) return toTicketDraft(current);
  const data = Object.fromEntries(changed.map((f) => [f, patch[f]]));
  const res = await deps.db.ticketDraft.updateMany({
    where: { id, status: { not: 'SUBMITTED' } },
    data: { ...data, version: { increment: 1 }, lastEditedBy: by, status: 'OPEN' },
  });
  if (res.count !== 1) throw draftSent();
  const draft = toTicketDraft(await findOwnDraft(deps.db, id, authorId));
  deps.live.publish({ draft, by, changed });
  return draft;
}
