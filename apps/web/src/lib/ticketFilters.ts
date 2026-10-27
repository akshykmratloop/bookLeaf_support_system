import type { AuthorTicketListItem } from '@bookleaf/shared';

export const TICKET_TABS = ['ALL', 'AWAITING', 'OPEN', 'SOLVED'] as const;
export type TicketTab = (typeof TICKET_TABS)[number];

export const TAB_LABELS: Record<TicketTab, string> = {
  ALL: 'All',
  AWAITING: 'Needs your reply',
  OPEN: 'Open',
  SOLVED: 'Solved',
};

const isOpen = (t: AuthorTicketListItem) => t.status === 'OPEN' || t.status === 'IN_PROGRESS';

const IN_TAB: Record<TicketTab, (t: AuthorTicketListItem) => boolean> = {
  ALL: () => true,
  AWAITING: (t) => t.awaitingYou,
  OPEN: isOpen,
  SOLVED: (t) => !isOpen(t),
};

const matches = (t: AuthorTicketListItem, q: string) =>
  [t.subject, t.number, t.book?.title ?? ''].some((field) => field.toLowerCase().includes(q));

export function filterTickets(
  tickets: readonly AuthorTicketListItem[],
  tab: TicketTab,
  search: string,
): AuthorTicketListItem[] {
  const q = search.trim().toLowerCase();
  return tickets.filter((t) => IN_TAB[tab](t) && (!q || matches(t, q)));
}

export const countByTab = (tickets: readonly AuthorTicketListItem[]) =>
  Object.fromEntries(TICKET_TABS.map((tab) => [tab, tickets.filter(IN_TAB[tab]).length])) as Record<
    TicketTab,
    number
  >;
