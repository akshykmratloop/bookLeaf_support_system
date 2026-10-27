import { useQuery } from '@tanstack/react-query';
import type {
  AdminVoiceCall,
  AssistantAdminStatus,
  AssistantAvailability,
  AssistantSettings,
  ChatReply,
  ChatSession,
  ChatTranscript,
  ChannelState,
  VoiceCall,
} from '@bookleaf/shared';
import { api } from './api';

export const assistantKeys = {
  availability: ['assistant', 'availability'] as const,
  admin: ['assistant', 'admin'] as const,
  currentChat: ['chat', 'current'] as const,
  transcript: (id: string) => ['chat', 'transcript', id] as const,
  voiceCall: (id: string) => ['voice', 'call', id] as const,
  adminVoiceCall: (id: string) => ['voice', 'admin-call', id] as const,
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

export const CHANNEL_LABEL: Record<ChannelState, string> = {
  AVAILABLE: 'Available to authors',
  DISABLED: 'Switched off',
  NOT_CONFIGURED: 'No credential on the server',
  AI_OUTAGE: 'AI unavailable',
};

/** Re-fetches while the server is still saving a call that dropped without a goodbye. */
export const useVoiceCallRecord = (id: string | null) =>
  useQuery({
    queryKey: assistantKeys.voiceCall(id ?? ''),
    queryFn: () => api<VoiceCall>(`/voice/calls/${id ?? ''}`),
    enabled: id !== null,
    refetchInterval: (q) =>
      q.state.data?.status === 'ACTIVE' && q.state.dataUpdateCount < 10 ? 1000 : false,
  });

export const useAdminVoiceCall = (id: string | null) =>
  useQuery({
    queryKey: assistantKeys.adminVoiceCall(id ?? ''),
    queryFn: () => api<AdminVoiceCall>(`/admin/voice/calls/${id ?? ''}`),
    enabled: id !== null,
  });
