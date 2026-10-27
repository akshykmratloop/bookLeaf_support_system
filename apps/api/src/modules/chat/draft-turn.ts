import type { TicketDraft } from '@bookleaf/shared';
import type { DraftAction } from '../../ai/chat/draft-action.js';
import { ConflictError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';

export const NEEDS_MORE_TEXT =
  'Before I can send it, the ticket needs a subject (at least 5 characters) and a description (at least 20). You can add them on the right, or tell me a bit more.';
export const CONFIRM_FIRST_TEXT =
  'Before I send it, please check the ticket on the right. Shall I send it?';
export const sentText = (number: string) =>
  `Done. I've sent ticket ${number}. The support team will reply on the ticket page, and you'll see updates there.`;

/** Draft races the author can cause (sent or edited it meanwhile) leave the draft as it is. */
const RACES = new Set(['DRAFT_SENT', 'DRAFT_CHANGED', 'DRAFT_NOT_CONFIRMED']);

interface Applied {
  /** Replaces the model's text when the server decided differently (or confirms sending). */
  bodyOverride: string | null;
}

const hasFields = (a: DraftAction) => Object.keys(a.patch).length > 0;

async function confirmOrExplain(
  drafts: TicketDraftService,
  authorId: string,
  draft: TicketDraft,
  confirmText: string | null,
): Promise<Applied> {
  if (!draft.isComplete) return { bodyOverride: NEEDS_MORE_TEXT };
  await drafts.requestConfirmation(authorId, draft.id);
  return { bodyOverride: confirmText };
}

async function apply(
  drafts: TicketDraftService,
  session: Session,
  chatSessionId: string,
  action: DraftAction,
): Promise<Applied> {
  const authorId = session.authorId ?? '';
  let draft = await drafts.forChat(authorId, chatSessionId);
  if (draft.status === 'SUBMITTED') return { bodyOverride: null };
  if (hasFields(action)) draft = await drafts.edit(authorId, draft.id, action.patch, 'ASSISTANT');
  if (action.kind === 'confirm') return confirmOrExplain(drafts, authorId, draft, null);
  if (action.kind !== 'submit') return { bodyOverride: null };
  // Sending needs a confirmation the author answered; otherwise ask for it now.
  if (draft.status !== 'AWAITING_CONFIRMATION')
    return confirmOrExplain(drafts, authorId, draft, CONFIRM_FIRST_TEXT);
  const sent = await drafts.submit(session, draft.id, { by: 'ASSISTANT', version: null });
  return { bodyOverride: sentText(sent.draft.ticket?.number ?? sent.ticket.number) };
}

/**
 * Applies the assistant's requested draft change under the server's rules: it can fill in and
 * change fields, ask for confirmation once the draft is complete, and send only after asking.
 */
export async function applyDraftAction(
  drafts: TicketDraftService,
  session: Session,
  chatSessionId: string,
  action: DraftAction | null,
): Promise<Applied> {
  if (!action || (action.kind === 'none' && !hasFields(action))) return { bodyOverride: null };
  try {
    return await apply(drafts, session, chatSessionId, action);
  } catch (err) {
    if (err instanceof ConflictError && RACES.has(err.code)) return { bodyOverride: null };
    throw err;
  }
}
