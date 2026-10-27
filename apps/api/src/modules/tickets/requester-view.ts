import type {
  AuthorTicket,
  LastActivity,
  MessageKind,
  TicketCategory,
  TicketSource,
  TicketStatus,
} from '@bookleaf/shared';

/** Longest preview of the last message in the ticket list. */
const PREVIEW_CHARS = 140;

export interface PublicMessage {
  kind: MessageKind;
  body: string;
  createdAt: Date;
}

interface TicketFacts {
  status: TicketStatus;
  category: TicketCategory | null;
  source: TicketSource;
  description: string;
  createdAt: Date;
}

/** Messages the author and the team wrote to each other (no notes, no system lines). */
export const CONVERSATION_KINDS: MessageKind[] = ['AUTHOR', 'REPLY'];

export const previewOf = (text: string) =>
  text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS).trimEnd()}…` : text;

/** The latest message of the conversation, from messages in time order. */
export const lastConversationMessage = (messages: readonly PublicMessage[]) =>
  messages.findLast((m) => CONVERSATION_KINDS.includes(m.kind)) ?? null;

type RequesterFields = Pick<
  AuthorTicket,
  'category' | 'channel' | 'lastActivity' | 'awaitingYou' | 'canSolve'
>;

/** The requester view's status fields: who spoke last, whether it is the author's turn. */
export function requesterFields(t: TicketFacts, last: PublicMessage | null): RequesterFields {
  const fromTeam = last?.kind === 'REPLY';
  const open = t.status === 'OPEN' || t.status === 'IN_PROGRESS';
  const lastActivity: LastActivity = last
    ? {
        from: fromTeam ? 'TEAM' : 'YOU',
        at: last.createdAt.toISOString(),
        preview: previewOf(last.body),
      }
    : { from: 'YOU', at: t.createdAt.toISOString(), preview: previewOf(t.description) };
  return {
    category: t.category,
    channel: t.source,
    lastActivity,
    awaitingYou: open && fromTeam,
    canSolve: open,
  };
}
