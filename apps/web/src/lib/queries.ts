import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
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

export const useAuthorTickets = () =>
  useQuery({
    queryKey: keys.tickets(),
    queryFn: () => api<Page<AuthorTicketListItem>>('/tickets?limit=200'),
  });

export const useAdminTickets = (filters: Record<string, string>) =>
  useQuery({
    queryKey: keys.tickets(filters),
    queryFn: () =>
      api<Page<AdminTicketListItem>>(`/tickets${toQuery({ limit: '200', ...filters })}`),
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
