import type { CustomerItem, TicketCustomer } from '@bookleaf/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { keys } from './queries';

/** Under the ticket's own key, so every live update of the ticket refreshes the panel too. */
export const customerKey = (ticketId: string) => [...keys.ticket(ticketId), 'customer'] as const;

/** The staff Customer panel's data (U-1): profile, record lines and the other tickets. */
export const useTicketCustomer = (ticketId: string) =>
  useQuery({
    queryKey: customerKey(ticketId),
    queryFn: () => api<TicketCustomer>(`/tickets/${ticketId}/customer`),
  });

/** The item the ticket is about first; the others in the product's own order. */
export const orderedItems = (items: readonly CustomerItem[]): CustomerItem[] => [
  ...items.filter((i) => i.isTicketItem),
  ...items.filter((i) => !i.isTicketItem),
];

/** "23 older tickets not shown." when the list is capped; null when every ticket is listed. */
export function moreTicketsText(shown: number, total: number): string | null {
  const hidden = total - shown;
  if (hidden <= 0) return null;
  return `${hidden} older ticket${hidden === 1 ? '' : 's'} not shown.`;
}

const plural = (noun: string) => (/(s|x|z|ch|sh)$/i.test(noun) ? `${noun}es` : `${noun}s`);

/** "Books (2)" from the workspace's item word ("book"); "Items" when none is set. */
export function itemsHeading(itemNoun: string, count: number): string {
  const noun = itemNoun.trim() || 'item';
  const word = plural(noun);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} (${count})`;
}
