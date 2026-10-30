import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  ConversationDetail,
  ConversationKind,
  ConversationPage,
  ConversationSummary,
} from '@bookleaf/shared';
import { api } from './api';

const PAGE_SIZE = 20;

export const conversationKeys = {
  list: ['conversations'] as const,
  one: (kind: ConversationKind, id: string) => ['conversation', kind, id] as const,
};

const API_SEGMENT: Record<ConversationKind, 'chats' | 'calls'> = { CHAT: 'chats', CALL: 'calls' };

/** Reads the kind back from the URL segment (`…/history/chat/:id`); anything else is not one. */
export const kindOf = (segment: string | undefined): ConversationKind | null =>
  segment === 'chat' ? 'CHAT' : segment === 'call' ? 'CALL' : null;

export interface Outcome {
  label: string;
  tone: 'success' | 'warning';
}

/** What came out of the conversation, as a short label and colour. */
export function outcomeOf(c: Pick<ConversationSummary, 'ticket' | 'draftStatus'>): Outcome | null {
  if (c.ticket) return { label: `Ticket ${c.ticket.number}`, tone: 'success' };
  if (c.draftStatus) return { label: 'Ticket not sent', tone: 'warning' };
  return null;
}

export const useConversations = () =>
  useInfiniteQuery({
    queryKey: conversationKeys.list,
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<ConversationPage>(
        `/conversations?limit=${PAGE_SIZE}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useConversation = (kind: ConversationKind, id: string) =>
  useQuery({
    queryKey: conversationKeys.one(kind, id),
    queryFn: () => api<ConversationDetail>(`/conversations/${API_SEGMENT[kind]}/${id}`),
  });
