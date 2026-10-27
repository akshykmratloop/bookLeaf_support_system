import type { AuthorTicketListItem } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { countByTab, filterTickets } from './ticketFilters';

const t = (patch: Partial<AuthorTicketListItem>) =>
  ({
    id: patch.number ?? 'x',
    number: 'BL-1001',
    subject: 'Royalty question',
    status: 'OPEN',
    awaitingYou: false,
    book: null,
    ...patch,
  }) as AuthorTicketListItem;

const tickets = [
  t({ number: 'BL-1001', status: 'OPEN' }),
  t({ number: 'BL-1002', status: 'IN_PROGRESS', awaitingYou: true, subject: 'ISBN typo' }),
  t({ number: 'BL-1003', status: 'RESOLVED', book: { id: 'b', title: 'Whispers of the Ganges' } }),
  t({ number: 'BL-1004', status: 'CLOSED' }),
];

const numbers = (list: AuthorTicketListItem[]) => list.map((x) => x.number);

describe('ticket filters', () => {
  it('splits tickets into needs-your-reply, open and solved', () => {
    expect(numbers(filterTickets(tickets, 'ALL', ''))).toHaveLength(4);
    expect(numbers(filterTickets(tickets, 'AWAITING', ''))).toEqual(['BL-1002']);
    expect(numbers(filterTickets(tickets, 'OPEN', ''))).toEqual(['BL-1001', 'BL-1002']);
    expect(numbers(filterTickets(tickets, 'SOLVED', ''))).toEqual(['BL-1003', 'BL-1004']);
  });

  it('searches the subject, number and book, ignoring case', () => {
    expect(numbers(filterTickets(tickets, 'ALL', 'isbn'))).toEqual(['BL-1002']);
    expect(numbers(filterTickets(tickets, 'ALL', '1003'))).toEqual(['BL-1003']);
    expect(numbers(filterTickets(tickets, 'ALL', 'ganges'))).toEqual(['BL-1003']);
    expect(filterTickets(tickets, 'SOLVED', 'isbn')).toEqual([]);
  });

  it('counts each tab', () => {
    expect(countByTab(tickets)).toEqual({ ALL: 4, AWAITING: 1, OPEN: 2, SOLVED: 2 });
  });
});
