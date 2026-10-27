import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatSession } from '@bookleaf/shared';
import { useState, useSyncExternalStore } from 'react';
import { errorMessage } from './api';
import { assistantKeys, sendChatMessage, startChat, useCurrentChat } from './assistant';
import { MessageQueue } from './chatQueue';

/** Chat state for the author: the latest conversation, the send queue and new conversation. */
export function useChat(enabled: boolean) {
  const qc = useQueryClient();
  const current = useCurrentChat(enabled);
  const setSession = (s: ChatSession) => qc.setQueryData(assistantKeys.currentChat, s);

  const [queue] = useState(
    () =>
      new MessageQueue(async (text) => {
        // Read the cache at send time: an earlier message in the queue may have started a chat.
        const existing = qc.getQueryData<ChatSession | null>(assistantKeys.currentChat);
        const session = existing ?? (await startChat());
        if (!existing) qc.setQueryData(assistantKeys.currentChat, session);
        const r = await sendChatMessage(session.id, text);
        qc.setQueryData(assistantKeys.currentChat, r.session);
      }, errorMessage),
  );
  const queued = useSyncExternalStore(queue.subscribe, queue.snapshot);

  const restart = useMutation({ mutationFn: startChat, onSuccess: setSession });

  return { current, session: current.data ?? null, queue, queued, restart };
}
