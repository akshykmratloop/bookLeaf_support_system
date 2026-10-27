import type { ConversationDetail } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { toTicketDraft } from '../ticket-drafts/mappers.js';
import { after, NEWEST_FIRST, type Cursor } from './cursor.js';
import { ticketRef, titleOf, type Listed } from './summary.js';

const TICKET = { select: { id: true, number: true } } as const;

/** Chats the author actually wrote in, newest first. */
export async function listChats(db: Db, authorId: string, from: Cursor | null, take: number) {
  const rows = await db.chatSession.findMany({
    where: { authorId, turnCount: { gt: 0 }, ...after(from) },
    orderBy: NEWEST_FIRST,
    take,
    include: {
      ticket: TICKET,
      ticketDraft: { select: { status: true, subject: true } },
      messages: { where: { role: 'AUTHOR' }, orderBy: { createdAt: 'asc' }, take: 1 },
      _count: { select: { messages: true } },
    },
  });
  return rows.map((r): Listed => ({
    at: r.createdAt,
    id: r.id,
    summary: {
      kind: 'CHAT',
      id: r.id,
      startedAt: r.createdAt.toISOString(),
      title: titleOf(r.ticketDraft?.subject, r.messages[0]?.body),
      messageCount: r._count.messages,
      ticket: ticketRef(r.ticket),
      draftStatus: r.ticketDraft?.status ?? null,
    },
  }));
}

/** One of the author's chats with every message, oldest first. */
export async function getChat(db: Db, authorId: string, id: string): Promise<ConversationDetail> {
  const chat = await db.chatSession.findFirst({
    where: { id, authorId },
    include: {
      ticket: TICKET,
      ticketDraft: { include: { ticket: TICKET } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!chat) throw new NotFoundError('Conversation');
  return {
    kind: 'CHAT',
    id: chat.id,
    startedAt: chat.createdAt.toISOString(),
    lines: chat.messages.map((m) => ({
      role: m.role,
      text: m.body,
      at: m.createdAt.toISOString(),
    })),
    draft: chat.ticketDraft ? toTicketDraft(chat.ticketDraft) : null,
    ticket: ticketRef(chat.ticket),
  };
}
