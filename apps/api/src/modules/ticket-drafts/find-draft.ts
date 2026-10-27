import type { TicketDraft } from '@bookleaf/shared';
import { NotFoundError } from '../../platform/errors.js';
import type { DraftDeps } from './deps.js';
import { toTicketDraft } from './mappers.js';
import { upsertChatDraft, upsertThreadDraft } from './repository.js';

/** The draft of a chat conversation the author owns (created on first use). */
export async function chatDraft(
  deps: DraftDeps,
  authorId: string,
  chatSessionId: string,
): Promise<TicketDraft> {
  if (!(await deps.db.chatSession.count({ where: { id: chatSessionId, authorId } })))
    throw new NotFoundError('Conversation');
  return toTicketDraft(await upsertChatDraft(deps.db, authorId, chatSessionId));
}

/** The draft of a call thread; the caller has already checked the author owns the call. */
export async function threadDraft(
  deps: DraftDeps,
  authorId: string,
  threadId: string,
): Promise<TicketDraft> {
  return toTicketDraft(await upsertThreadDraft(deps.db, authorId, threadId));
}
