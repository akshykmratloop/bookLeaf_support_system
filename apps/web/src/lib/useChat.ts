import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatSession } from '@bookleaf/shared';
import { useState, useSyncExternalStore } from 'react';
import { errorMessage } from './api';
import { assistantKeys, sendChatMessage, startChat, useCurrentChat } from './assistant';
import { ChatDelivery } from './chatDelivery';
import { MessageQueue } from './chatQueue';
import { conversationKeys } from './conversations';

/** Chat state for the author: the latest conversation, the send queue and new conversation. */
export function useChat(enabled: boolean, onRestarted?: () => void) {
  const qc = useQueryClient();
  const current = useCurrentChat(enabled);

  const [{ delivery, queue }] = useState(() => {
    const d = new ChatDelivery(
      {
        get: () => qc.getQueryData<ChatSession | null>(assistantKeys.currentChat),
        set: (s) => {
          qc.setQueryData(assistantKeys.currentChat, s);
          // History lists this conversation as soon as it has a message.
          void qc.invalidateQueries({ queryKey: conversationKeys.list });
        },
      },
      { start: startChat, send: sendChatMessage },
    );
    return { delivery: d, queue: new MessageQueue(d.deliver, errorMessage) };
  });
  const queued = useSyncExternalStore(queue.subscribe, queue.snapshot);

  const restart = useMutation({
    mutationFn: () => {
      queue.clear();
      return delivery.restart();
    },
    onSuccess: () => onRestarted?.(),
    // The old conversation stays on screen; reload it so an answer that arrived is shown.
    onError: () => void qc.invalidateQueries({ queryKey: assistantKeys.currentChat }),
  });

  return { current, session: current.data ?? null, queue, queued, restart };
}
