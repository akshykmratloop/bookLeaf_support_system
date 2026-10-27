import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatSession } from '@bookleaf/shared';
import { errorMessage } from './api';
import { assistantKeys, startChat } from './assistant';
import type { VoiceCallControls } from './voice/useVoiceCall';

/**
 * Starts a call inside the current chat, so the call hears the chat and its lines are saved
 * into it. With no chat yet, one is started first (an empty conversation to talk in).
 */
export function useCallInChat(call: VoiceCallControls) {
  const qc = useQueryClient();
  const prepare = useMutation({
    mutationFn: async () => {
      const existing = qc.getQueryData<ChatSession | null>(assistantKeys.currentChat);
      if (existing) return existing;
      const created = await startChat();
      qc.setQueryData(assistantKeys.currentChat, created);
      return created;
    },
    onSuccess: (chat) => call.start({ chatSessionId: chat.id }),
  });
  return {
    start: () => prepare.mutate(),
    isPreparing: prepare.isPending,
    error: prepare.error ? `Could not start the call. ${errorMessage(prepare.error)}` : null,
  };
}

export type CallInChatControls = ReturnType<typeof useCallInChat>;
