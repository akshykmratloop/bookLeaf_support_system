import { royaltySignals } from '../domain/signals.js';
import type { TicketContext } from '../jobs/context.js';
import type { DraftInput } from './types.js';

/** One builder for draft generation and send-time checks, so both judge against the same facts. */
export function draftInputFromContext(ctx: TicketContext): DraftInput {
  return {
    category: ctx.ticket.category ?? 'GENERAL_INQUIRY',
    authorName: ctx.authorName,
    book: ctx.book,
    facts: ctx.facts,
    royalty: royaltySignals(ctx.facts, ctx.book?.externalId ?? null),
    subject: ctx.ticket.subject,
    authorMessages: ctx.authorMessages,
    lastTeamReply: ctx.lastReply,
    ignorePhrases: ctx.bookTitles,
  };
}
