import { useQuery } from '@tanstack/react-query';
import type {
  AssistantAdminStatus,
  AssistantAvailability,
  AssistantSettings,
  AuthorTicket,
  ChatReply,
  ChatSession,
  ChatTicketRequest,
  ChatTranscript,
  ChannelState,
} from '@bookleaf/shared';
import { api } from './api';

export const assistantKeys = {
  availability: ['assistant', 'availability'] as const,
  admin: ['assistant', 'admin'] as const,
  currentChat: ['chat', 'current'] as const,
  transcript: (id: string) => ['chat', 'transcript', id] as const,
};

/** Whether chat/voice are on. Polled slowly so an admin switch reaches open pages. */
export const useAssistantAvailability = (enabled = true) =>
  useQuery({
    queryKey: assistantKeys.availability,
    queryFn: () => api<AssistantAvailability>('/assistant/availability'),
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

export const useAssistantAdmin = () =>
  useQuery({
    queryKey: assistantKeys.admin,
    queryFn: () => api<AssistantAdminStatus>('/admin/assistant'),
  });

export const useCurrentChat = (enabled: boolean) =>
  useQuery({
    queryKey: assistantKeys.currentChat,
    queryFn: () => api<ChatSession | null>('/chat/sessions/current'),
    enabled,
  });

export const useChatTranscript = (id: string | null) =>
  useQuery({
    queryKey: assistantKeys.transcript(id ?? ''),
    queryFn: () => api<ChatTranscript>(`/admin/chat/sessions/${id ?? ''}`),
    enabled: id !== null,
  });

export const saveAssistantSettings = (
  input: Partial<Pick<AssistantSettings, 'chatEnabled' | 'voiceEnabled' | 'chatModel'>> & {
    version: number;
  },
) => api<AssistantSettings>('/admin/assistant/settings', { method: 'PUT', body: input });

export const startChat = () => api<ChatSession>('/chat/sessions', { method: 'POST' });

export const sendChatMessage = (sessionId: string, body: string) =>
  api<ChatReply>(`/chat/sessions/${sessionId}/messages`, { method: 'POST', body: { body } });

export const raiseChatTicket = (sessionId: string, body: ChatTicketRequest, key: string) =>
  api<AuthorTicket>(`/chat/sessions/${sessionId}/ticket`, {
    method: 'POST',
    body,
    idempotencyKey: key,
  });

export const CHANNEL_LABEL: Record<ChannelState, string> = {
  AVAILABLE: 'Available to authors',
  DISABLED: 'Switched off',
  NOT_CONFIGURED: 'No credential on the server',
  AI_OUTAGE: 'AI unavailable',
};
