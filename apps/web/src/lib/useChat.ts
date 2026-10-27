import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatSession, TicketProposal } from '@bookleaf/shared';
import { useState } from 'react';
import {
  assistantKeys,
  raiseChatTicket,
  sendChatMessage,
  startChat,
  useCurrentChat,
} from './assistant';
import { newRequestKey } from './ids';
import { keys } from './queries';

/** Chat state for the author: the latest conversation, sending, new conversation, ticket. */
export function useChat(enabled: boolean) {
  const qc = useQueryClient();
  const current = useCurrentChat(enabled);
  const [ticketKey, setTicketKey] = useState(newRequestKey);
  const setSession = (s: ChatSession) => qc.setQueryData(assistantKeys.currentChat, s);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const session = current.data ?? (await startChat());
      if (!current.data) setSession(session);
      return sendChatMessage(session.id, text);
    },
    onSuccess: (r) => setSession(r.session),
  });

  const restart = useMutation({
    mutationFn: startChat,
    onSuccess: (s) => {
      setSession(s);
      setTicketKey(newRequestKey());
    },
  });

  const raise = useMutation({
    mutationFn: (values: TicketProposal) => {
      if (!current.data) throw new Error('No conversation');
      return raiseChatTicket(current.data.id, values, ticketKey);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: assistantKeys.currentChat }),
        qc.invalidateQueries({ queryKey: keys.tickets() }),
      ]);
    },
  });

  return { current, session: current.data ?? null, send, restart, raise };
}
