import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatSession, TicketDraft } from '@bookleaf/shared';
import { assistantKeys, startChat, useCurrentChat } from './assistant';
import { keys } from './queries';
import { getChatDraft } from './ticketDrafts';

/** The current chat conversation's ticket draft, kept in the same cache as the conversation. */
export function useChatDraft(enabled: boolean) {
  const qc = useQueryClient();
  const current = useCurrentChat(enabled);
  const session = current.data ?? null;

  /** A saved or sent version updates the conversation, so the next chat turn sees it. */
  const onSaved = (draft: TicketDraft) => {
    qc.setQueryData<ChatSession | null>(assistantKeys.currentChat, (s) =>
      s && (s.draft === null || s.draft.id === draft.id) ? { ...s, draft } : s,
    );
    if (draft.status === 'SUBMITTED') void qc.invalidateQueries({ queryKey: keys.tickets() });
  };

  const start = useMutation({
    mutationFn: async () => {
      const s = session ?? (await startChat());
      return { s, draft: await getChatDraft(s.id) };
    },
    onSuccess: ({ s, draft }) => {
      const next: ChatSession = { ...s, draft };
      qc.setQueryData(assistantKeys.currentChat, next);
    },
  });

  return { draft: session?.draft ?? null, onSaved, start };
}
