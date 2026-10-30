import {
  CreateTicketRequestSchema,
  type AuthorTicket,
  type DraftEditor,
  type TicketDraft,
} from '@bookleaf/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { createTicket, getAuthorTicket, type TicketOrigin } from '../tickets/create.js';
import { draftChanged, type DraftDeps } from './deps.js';
import { toTicketDraft } from './mappers.js';
import { findOwnDraft, latestCallOfThread, type TicketDraftRow } from './repository.js';

export interface SubmitDraft {
  id: string;
  by: DraftEditor;
  /** The version the author sees; null when the assistant sends after confirmation. */
  version: number | null;
}

interface Submitted {
  draft: TicketDraft;
  ticket: AuthorTicket;
  created: boolean;
}

/** Where a sent draft's ticket comes from: its chat conversation or the thread's latest call. */
async function originFor(deps: DraftDeps, d: TicketDraftRow): Promise<TicketOrigin> {
  if (d.chatSessionId) {
    const chat = await deps.db.chatSession.findUnique({
      where: { id: d.chatSessionId },
      select: { ticket: { select: { id: true } } },
    });
    if (chat?.ticket)
      throw new ConflictError('CHAT_TICKET_EXISTS', 'A ticket was already raised here.');
    return { source: 'CHAT', chatSessionId: d.chatSessionId, category: d.categoryKey };
  }
  const call = d.voiceThreadId ? await latestCallOfThread(deps.db, d.voiceThreadId) : null;
  if (!call) throw new NotFoundError('Voice call');
  return { source: 'VOICE', voiceSessionId: call.id, category: d.categoryKey };
}

function assertCanSubmit(d: TicketDraftRow, { by, version }: SubmitDraft) {
  if (by === 'AUTHOR' && version !== d.version) throw draftChanged();
  if (by === 'ASSISTANT' && d.status !== 'AWAITING_CONFIRMATION')
    throw new ConflictError(
      'DRAFT_NOT_CONFIRMED',
      'Read the ticket back to the author and ask them to confirm before sending.',
    );
}

function ticketInputOf(d: TicketDraftRow) {
  const input = CreateTicketRequestSchema.safeParse(d);
  if (!input.success)
    throw new ValidationError(
      'Add a subject (at least 5 characters) and a description (at least 20) first.',
    );
  return input.data;
}

/** Marks the draft sent inside the ticket's transaction, only if nobody changed it meanwhile. */
function markSent(d: TicketDraftRow): TicketOrigin['afterCreate'] {
  return async (tx, ticketId) => {
    const res = await tx.ticketDraft.updateMany({
      where: { id: d.id, version: d.version, status: { not: 'SUBMITTED' } },
      data: { status: 'SUBMITTED', ticketId },
    });
    if (res.count !== 1) throw draftChanged();
  };
}

/** An already-sent draft: its ticket, nothing created. */
async function alreadySent(deps: DraftDeps, session: Session, d: TicketDraftRow) {
  if (d.status !== 'SUBMITTED' || !d.ticket) return null;
  const ticket = await getAuthorTicket(deps, session, d.ticket.id);
  return { draft: toTicketDraft(d), ticket, created: false };
}

async function sendOnce(
  deps: DraftDeps,
  session: Session,
  input: SubmitDraft,
  d: TicketDraftRow,
): Promise<Submitted> {
  assertCanSubmit(d, input);
  const ticketInput = ticketInputOf(d);
  const origin = { ...(await originFor(deps, d)), afterCreate: markSent(d) };
  // The draft id is the idempotency key: a draft can only ever become one ticket.
  const { ticket, created } = await createTicket(deps, session, ticketInput, {
    idempotencyKey: `draft:${input.id}`,
    origin,
  });
  const draft = toTicketDraft(await findOwnDraft(deps.db, input.id, session.authorId ?? ''));
  deps.live.publish({ draft, by: input.by, changed: ['status'] });
  return { draft, ticket, created };
}

/**
 * Sends the draft as a ticket, exactly once, with the issue type the author chose. A second Send
 * racing the first can see the first's ticket half-way (the chat already has it, or the draft
 * moved on); it then reads the draft again and answers with the ticket the first one sent.
 */
export async function submitDraft(
  deps: DraftDeps,
  session: Session,
  input: SubmitDraft,
): Promise<Submitted> {
  const authorId = session.authorId ?? '';
  const d = await findOwnDraft(deps.db, input.id, authorId);
  const sent = await alreadySent(deps, session, d);
  if (sent) return sent;
  try {
    return await sendOnce(deps, session, input, d);
  } catch (err) {
    if (!(err instanceof ConflictError)) throw err;
    const raced = await alreadySent(deps, session, await findOwnDraft(deps.db, input.id, authorId));
    if (raced) return raced;
    throw err;
  }
}
