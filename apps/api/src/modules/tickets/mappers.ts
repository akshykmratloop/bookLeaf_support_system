import type { AiJob, Book, Ticket, TicketMessage as MessageRow } from '@prisma/client';
import {
  type AdminTicket,
  type AdminTicketListItem,
  type AuthorTicket,
  type AuthorTicketListItem,
  type TicketMessage,
} from '@bookleaf/shared';
import { lastConversationMessage, requesterFields, type PublicMessage } from './requester-view.js';
import { labelOf } from './ticket-ref.js';

type Person = { id: string; name: string };
type MessageWithSender = MessageRow & { sender: Person | null };

export type TicketRow = Ticket & {
  book: Pick<Book, 'id' | 'title'> | null;
  author: { id: string; user: Person };
  assignee: Person | null;
  workspace: { ticketPrefix: string };
};

const iso = (d: Date) => d.toISOString();
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const bookRef = (t: TicketRow) => (t.book ? { id: t.book.id, title: t.book.title } : null);

/** Authors never see who on the team wrote a reply beyond "BookLeaf Support", nor internal notes. */
export function toMessage(m: MessageWithSender, audience: 'AUTHOR' | 'ADMIN'): TicketMessage {
  const senderName =
    m.kind === 'AUTHOR'
      ? (m.sender?.name ?? null)
      : m.kind === 'SYSTEM'
        ? null
        : audience === 'ADMIN'
          ? (m.sender?.name ?? null)
          : 'BookLeaf Support';
  return { id: m.id, kind: m.kind, body: m.body, senderName, createdAt: iso(m.createdAt) };
}

export function toAuthorListItem(
  t: TicketRow & { _count: { messages: number }; messages: PublicMessage[] },
): AuthorTicketListItem {
  return {
    id: t.id,
    number: labelOf(t),
    subject: t.subject,
    status: t.status,
    ...requesterFields(t, t.messages[0] ?? null),
    book: bookRef(t),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
    replyCount: t._count.messages,
  };
}

export function toAuthorTicket(t: TicketRow, messages: MessageWithSender[]): AuthorTicket {
  return {
    id: t.id,
    number: labelOf(t),
    subject: t.subject,
    description: t.description,
    status: t.status,
    ...requesterFields(t, lastConversationMessage(messages)),
    book: bookRef(t),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
    messages: messages.filter((m) => m.kind !== 'INTERNAL_NOTE').map((m) => toMessage(m, 'AUTHOR')),
  };
}

export function toAdminListItem(t: TicketRow): AdminTicketListItem {
  return {
    id: t.id,
    number: labelOf(t),
    subject: t.subject,
    status: t.status,
    category: t.category,
    categorySource: t.categorySource,
    priority: t.priority,
    prioritySource: t.prioritySource,
    aiState: t.aiState,
    needsReview: t.needsReview,
    slaDueAt: iso(t.slaDueAt),
    firstResponseAt: t.firstResponseAt ? iso(t.firstResponseAt) : null,
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
    author: { id: t.author.id, name: t.author.user.name },
    assignee: t.assignee,
    book: bookRef(t),
  };
}

/** Latest job per kind, so the UI can show "Queued", "Retrying (2 of 3)", "Fallback". */
function latestJobs(jobs: AiJob[]) {
  const latest = new Map<string, AiJob>();
  for (const j of jobs)
    if ((latest.get(j.kind)?.generation ?? -1) < j.generation) latest.set(j.kind, j);
  return [...latest.values()].map((j) => ({
    kind: j.kind,
    status: j.status,
    attempts: j.attempts,
    maxAttempts: j.maxAttempts,
    lastErrorCode: j.lastErrorCode,
  }));
}

export function toAdminTicket(
  t: TicketRow,
  messages: MessageWithSender[],
  jobs: AiJob[],
): AdminTicket {
  return {
    ...toAdminListItem(t),
    description: t.description,
    priorityReasons: strings(t.priorityReasons),
    needsInfo: strings(t.needsInfo),
    aiConfidence: t.aiConfidence,
    version: t.version,
    messages: messages.map((m) => toMessage(m, 'ADMIN')),
    aiJobs: latestJobs(jobs),
    source: t.source,
    chatSessionId: t.chatSessionId,
    voiceSessionId: t.voiceSessionId,
  };
}
