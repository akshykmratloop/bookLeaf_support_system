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

  /**
   * A saved or sent version updates the conversation, so the next chat turn sees it. Only the
   * conversation's own draft: a late save from an old conversation must not attach to a new one.
   */
  const onSaved = (draft: TicketDraft) => {
    qc.setQueryData<ChatSession | null>(assistantKeys.currentChat, (s) =>
      s?.draft?.id === draft.id ? { ...s, draft } : s,
    );
    if (draft.status === 'SUBMITTED') void qc.invalidateQueries({ queryKey: keys.tickets() });
  };

  const start = useMutation({
    mutationFn: async () => {
      // Read the cache now, not the render's copy: New conversation may have just replaced it.
      const s =
        qc.getQueryData<ChatSession | null>(assistantKeys.currentChat) ?? (await startChat());
      return { s, draft: await getChatDraft(s.id) };
    },
    onSuccess: ({ s, draft }) => {
      const next: ChatSession = { ...s, draft };
      qc.setQueryData(assistantKeys.currentChat, next);
    },
  });

  return { draft: session?.draft ?? null, onSaved, start };
}
