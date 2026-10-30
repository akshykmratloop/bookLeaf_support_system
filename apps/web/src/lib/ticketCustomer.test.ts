import { describe, expect, it } from 'vitest';
import type { CustomerItem } from '@bookleaf/shared';
import { itemsHeading, moreTicketsText, orderedItems } from './ticketCustomer';

const item = (title: string, isTicketItem = false): CustomerItem => ({
  id: null,
  externalId: title,
  title,
  isTicketItem,
  lines: [],
});

describe('the Customer panel helpers', () => {
  it("puts the ticket's own item first and keeps the rest in the product's order", () => {
    const items = [item('A'), item('B'), item('C', true)];
    expect(orderedItems(items).map((i) => i.title)).toEqual(['C', 'A', 'B']);
    expect(items.map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });

  it('says how many older tickets are not listed, and nothing when all are shown', () => {
    expect(moreTicketsText(50, 73)).toBe('23 older tickets not shown.');
    expect(moreTicketsText(50, 51)).toBe('1 older ticket not shown.');
    expect(moreTicketsText(3, 3)).toBeNull();
  });

  it("names the items with the workspace's own word", () => {
    expect(itemsHeading('book', 2)).toBe('Books (2)');
    expect(itemsHeading('item', 1)).toBe('Items (1)');
    expect(itemsHeading('class', 3)).toBe('Classes (3)');
    expect(itemsHeading('  ', 1)).toBe('Items (1)');
  });
});
