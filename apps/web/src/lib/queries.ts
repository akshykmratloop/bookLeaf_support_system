import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import type {
  AdminTicket,
  AdminTicketListItem,
  AuthUser,
  AuthorTicket,
  AuthorTicketListItem,
  Book,
  BookList,
  CheckResult,
  Draft,
} from '@bookleaf/shared';
import { api } from './api';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const keys = {
  me: ['me'] as const,
  books: ['books'] as const,
  tickets: (filters: Record<string, string> = {}) => ['tickets', filters] as const,
  ticket: (id: string) => ['ticket', id] as const,
  draft: (id: string) => ['draft', id] as const,
};

export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: () => api<{ user: AuthUser }>('/auth/me').then((r) => r.user),
    retry: false,
    staleTime: 60_000,
  });

const fetchBooks = () => api<BookList>('/books');

/** The author's books with the host's details, plus account totals (the books page). */
export const useBookList = () => useQuery({ queryKey: keys.books, queryFn: fetchBooks });

/** Just the books, for pickers (same request, same cache). */
export const useBooks = () =>
  useQuery({ queryKey: keys.books, queryFn: fetchBooks, select: (r): Book[] => r.items });

function toQuery(filters: Record<string, string>): string {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ''));
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Tickets per request; "Load more" asks for the next page with the API's cursor. */
export const TICKET_PAGE_SIZE = 50;

/** One page of the ticket list: the filters, the page size and, after the first, the cursor. */
export const ticketListPath = (filters: Record<string, string>, cursor: string | null) =>
  `/tickets${toQuery({ ...filters, limit: String(TICKET_PAGE_SIZE), cursor: cursor ?? '' })}`;

/** The cursor of the next page, or undefined when this was the last one. */
export const nextCursorOf = <T>(page: Page<T>): string | undefined => page.nextCursor ?? undefined;

/** Every page loaded so far, as one list. */
export const allItems = <T>(data: InfiniteData<Page<T>, string | null>) => ({
  items: data.pages.flatMap((p) => p.items),
});

/** The browser's time zone, so date filters ("from", "to") mean the staff member's own days. */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** A ticket list read page by page; `data.items` holds every page loaded so far. */
function useTicketPages<T>(key: QueryKey, filters: Record<string, string>) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) =>
      api<Page<T>>(ticketListPath(filters, pageParam), { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursorOf<T>,
    select: allItems<T>,
  });
}

export const useAuthorTickets = () => useTicketPages<AuthorTicketListItem>(keys.tickets(), {});

export const useAdminTickets = (filters: Record<string, string>) =>
  useTicketPages<AdminTicketListItem>(keys.tickets(filters), {
    ...filters,
    tz: browserTimeZone(),
  });

export const useAuthorTicket = (id: string) =>
  useQuery({ queryKey: keys.ticket(id), queryFn: () => api<AuthorTicket>(`/tickets/${id}`) });
export const useAdminTicket = (id: string) =>
  useQuery({ queryKey: keys.ticket(id), queryFn: () => api<AdminTicket>(`/tickets/${id}`) });

/** While a draft is being generated, poll gently in case an SSE hint is missed. */
export const useDraft = (id: string) =>
  useQuery({
    queryKey: keys.draft(id),
    queryFn: () => api<{ draft: Draft | null; pending: boolean }>(`/tickets/${id}/draft`),
    refetchInterval: (q) => (q.state.data?.pending ? 4000 : false),
  });

/** Mutation that refreshes the given queries on success. */
export function useApiMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  invalidate: QueryKey[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(invalidate.map((key) => qc.invalidateQueries({ queryKey: key })));
    },
  });
}

export const checkReply = (ticketId: string, body: string) =>
  api<CheckResult>(`/tickets/${ticketId}/check`, { method: 'POST', body: { body } });
