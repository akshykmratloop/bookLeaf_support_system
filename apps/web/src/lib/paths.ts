import type { ConversationKind } from '@bookleaf/shared';

/** The author's support app lives under /embed (in the widget, or full page from the host). */
export const authorPaths = {
  home: '/embed',
  ask: '/embed/ask',
  tickets: '/embed/tickets',
  newTicket: '/embed/tickets/new',
  ticket: (id: string) => `/embed/tickets/${id}`,
  history: '/embed/history',
  conversation: (kind: ConversationKind, id: string) =>
    `/embed/history/${kind === 'CHAT' ? 'chat' : 'call'}/${id}`,
};
