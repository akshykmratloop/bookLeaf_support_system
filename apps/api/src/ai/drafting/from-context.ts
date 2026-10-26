import type { TicketContext } from '../jobs/context.js';
import { buildFactsPack } from '../facts/index.js';
import type { DraftInput } from './types.js';

/** One builder for draft generation and send-time checks, so both judge against the same facts. */
export function draftInputFromContext(ctx: TicketContext, dataAsOf: Date): DraftInput {
  const text = `${ctx.ticket.subject}\n${ctx.authorMessages.join('\n')}`;
  const { facts, royalty } = buildFactsPack({ author: ctx.author, bookId: ctx.book?.id ?? null, text, dataAsOf });
  return {
    category: ctx.ticket.category ?? 'GENERAL_INQUIRY',
    authorName: ctx.author.name,
    book: ctx.book ? { externalId: ctx.book.externalId, title: ctx.book.title } : null,
    facts,
    royalty,
    subject: ctx.ticket.subject,
    authorMessages: ctx.authorMessages,
    lastTeamReply: ctx.lastReply,
    ignorePhrases: ctx.author.books.map((b) => b.title),
  };
}
