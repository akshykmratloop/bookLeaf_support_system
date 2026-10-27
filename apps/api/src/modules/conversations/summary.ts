import { ticketNumberLabel, type ConversationSummary } from '@bookleaf/shared';

const TITLE_MAX = 80;

/** The draft's subject when there is one, otherwise the author's first words. */
export function titleOf(subject: string | undefined, firstWords: string | undefined): string {
  const text = (subject?.trim() || firstWords?.trim() || 'Conversation').replace(/\s+/g, ' ');
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;
}

export const ticketRef = (t: { id: string; number: number } | null | undefined) =>
  t ? { id: t.id, number: ticketNumberLabel(t.number) } : null;

/** A summary plus the position it sorts at; the position becomes the next page's cursor. */
export interface Listed {
  at: Date;
  id: string;
  summary: ConversationSummary;
}
