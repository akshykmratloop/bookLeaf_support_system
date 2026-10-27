import {
  CreateTicketRequestSchema,
  type AuthorTicket,
  type DraftEditor,
  type EditTicketDraftSchema,
  type TicketDraft,
} from '@bookleaf/shared';
import type { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { createTicket, getAuthorTicket, type TicketOrigin } from '../tickets/create.js';
import type { TicketDeps } from '../tickets/deps.js';
import type { DraftLiveUpdates } from './live.js';
import { isDraftComplete, toTicketDraft } from './mappers.js';
import {
  findOwnDraft,
  latestCallOfThread,
  upsertChatDraft,
  upsertThreadDraft,
  type TicketDraftRow,
} from './repository.js';

export type DraftPatch = z.output<typeof EditTicketDraftSchema>;
type Field = 'category' | 'bookId' | 'subject' | 'description';
const FIELDS: Field[] = ['category', 'bookId', 'subject', 'description'];

interface Deps extends TicketDeps {
  live: DraftLiveUpdates;
}

const SENT = () => new ConflictError('DRAFT_SENT', 'This ticket has already been sent.');
const CHANGED = () =>
  new ConflictError('DRAFT_CHANGED', 'The draft just changed. Check it and press Send again.');

export function createTicketDraftService(deps: Deps) {
  const { db, live } = deps;

  async function assertOwnBook(authorId: string, bookId: string | null | undefined) {
    if (!bookId) return;
    if (!(await db.book.count({ where: { id: bookId, authorId } })))
      throw new ValidationError('Choose one of your own books.', [
        { path: 'bookId', message: 'Not one of your books' },
      ]);
  }

  /** Where a sent draft's ticket comes from: its chat conversation or the thread's latest call. */
  async function originFor(d: TicketDraftRow): Promise<TicketOrigin> {
    if (d.chatSessionId) {
      const chat = await db.chatSession.findUnique({
        where: { id: d.chatSessionId },
        select: { ticket: { select: { id: true } } },
      });
      if (chat?.ticket)
        throw new ConflictError('CHAT_TICKET_EXISTS', 'A ticket was already raised here.');
      return { source: 'CHAT', chatSessionId: d.chatSessionId, category: d.category };
    }
    const call = d.voiceThreadId ? await latestCallOfThread(db, d.voiceThreadId) : null;
    if (!call) throw new NotFoundError('Voice call');
    return { source: 'VOICE', voiceSessionId: call.id, category: d.category };
  }

  function assertCanSubmit(d: TicketDraftRow, by: DraftEditor, version: number | null) {
    if (by === 'AUTHOR' && version !== d.version) throw CHANGED();
    if (by === 'ASSISTANT' && d.status !== 'AWAITING_CONFIRMATION')
      throw new ConflictError(
        'DRAFT_NOT_CONFIRMED',
        'Read the ticket back to the author and ask them to confirm before sending.',
      );
  }

  return {
    /** The draft of a chat conversation the author owns (created on first use). */
    async forChat(authorId: string, chatSessionId: string): Promise<TicketDraft> {
      if (!(await db.chatSession.count({ where: { id: chatSessionId, authorId } })))
        throw new NotFoundError('Conversation');
      return toTicketDraft(await upsertChatDraft(db, authorId, chatSessionId));
    },

    /** The draft of a call thread; the caller has already checked the author owns the call. */
    async forThread(authorId: string, threadId: string): Promise<TicketDraft> {
      return toTicketDraft(await upsertThreadDraft(db, authorId, threadId));
    },

    /** Field-level edit. Any change resets a pending confirmation: confirm only what was seen. */
    async edit(authorId: string, id: string, patch: DraftPatch, by: DraftEditor) {
      const current = await findOwnDraft(db, id, authorId);
      if (current.status === 'SUBMITTED') throw SENT();
      await assertOwnBook(authorId, patch.bookId);
      const changed = FIELDS.filter((f) => patch[f] !== undefined && patch[f] !== current[f]);
      if (changed.length === 0) return toTicketDraft(current);
      const data = Object.fromEntries(changed.map((f) => [f, patch[f]]));
      const res = await db.ticketDraft.updateMany({
        where: { id, status: { not: 'SUBMITTED' } },
        data: { ...data, version: { increment: 1 }, lastEditedBy: by, status: 'OPEN' },
      });
      if (res.count !== 1) throw SENT();
      const draft = toTicketDraft(await findOwnDraft(db, id, authorId));
      live.publish({ draft, by, changed });
      return draft;
    },

    /** The assistant read the draft back and asked "shall I send it?". */
    async requestConfirmation(authorId: string, id: string): Promise<TicketDraft> {
      const current = await findOwnDraft(db, id, authorId);
      if (current.status === 'SUBMITTED') throw SENT();
      if (!isDraftComplete(current))
        throw new ValidationError('The draft needs a subject and a description first.');
      await db.ticketDraft.update({ where: { id }, data: { status: 'AWAITING_CONFIRMATION' } });
      const draft = toTicketDraft(await findOwnDraft(db, id, authorId));
      live.publish({ draft, by: 'ASSISTANT', changed: ['status'] });
      return draft;
    },

    /** Sends the draft as a ticket, exactly once, with the issue type the author chose. */
    async submit(
      session: Session,
      id: string,
      opts: { by: DraftEditor; version: number | null },
    ): Promise<{ draft: TicketDraft; ticket: AuthorTicket; created: boolean }> {
      const authorId = session.authorId ?? '';
      const d = await findOwnDraft(db, id, authorId);
      if (d.status === 'SUBMITTED' && d.ticket) {
        const ticket = await getAuthorTicket(deps, session, d.ticket.id);
        return { draft: toTicketDraft(d), ticket, created: false };
      }
      assertCanSubmit(d, opts.by, opts.version);
      const input = CreateTicketRequestSchema.safeParse(d);
      if (!input.success)
        throw new ValidationError(
          'Add a subject (at least 5 characters) and a description (at least 20) first.',
        );
      const origin: TicketOrigin = {
        ...(await originFor(d)),
        afterCreate: async (tx, ticketId) => {
          const res = await tx.ticketDraft.updateMany({
            where: { id, version: d.version, status: { not: 'SUBMITTED' } },
            data: { status: 'SUBMITTED', ticketId },
          });
          if (res.count !== 1) throw CHANGED();
        },
      };
      // The draft id is the idempotency key: a draft can only ever become one ticket.
      const key = `draft:${id}`;
      const { ticket, created } = await createTicket(deps, session, input.data, key, origin);
      const draft = toTicketDraft(await findOwnDraft(db, id, authorId));
      live.publish({ draft, by: opts.by, changed: ['status'] });
      return { draft, ticket, created };
    },
  };
}

export type TicketDraftService = ReturnType<typeof createTicketDraftService>;
