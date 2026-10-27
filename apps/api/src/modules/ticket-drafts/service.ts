import type { DraftEditor } from '@bookleaf/shared';
import type { Session } from '../auth/session.js';
import { requestConfirmation } from './confirm-draft.js';
import type { DraftDeps, DraftPatch } from './deps.js';
import { discardDraft } from './discard-draft.js';
import { editDraft } from './edit-draft.js';
import { chatDraft, threadDraft } from './find-draft.js';
import { submitDraft } from './submit-draft.js';

export type { DraftPatch } from './deps.js';

/** The ticket draft the author and the assistant prepare together, then send once. */
export function createTicketDraftService(deps: DraftDeps) {
  return {
    forChat: (authorId: string, chatSessionId: string) => chatDraft(deps, authorId, chatSessionId),
    forThread: (authorId: string, threadId: string) => threadDraft(deps, authorId, threadId),
    edit: (authorId: string, id: string, patch: DraftPatch, by: DraftEditor) =>
      editDraft(deps, authorId, { id, patch, by }),
    discard: (authorId: string, id: string, version: number) =>
      discardDraft(deps, authorId, { id, version }),
    requestConfirmation: (authorId: string, id: string) => requestConfirmation(deps, authorId, id),
    submit: (s: Session, id: string, opts: { by: DraftEditor; version: number | null }) =>
      submitDraft(deps, s, { id, ...opts }),
  };
}

export type TicketDraftService = ReturnType<typeof createTicketDraftService>;
