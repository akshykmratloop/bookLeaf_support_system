import { useQuery } from '@tanstack/react-query';
import type { EditTicketDraft, TicketDraft, VoiceCall } from '@bookleaf/shared';
import { api } from './api';

export interface SubmitDraftReply {
  draft: TicketDraft;
  ticket: { id: string; number: string };
}

/** The ticket draft of one of my chat conversations (created on first use). */
export const getChatDraft = (sessionId: string) =>
  api<TicketDraft>(`/ticket-drafts/chat/${sessionId}`);

export const editDraft = (id: string, patch: EditTicketDraft) =>
  api<TicketDraft>(`/ticket-drafts/${id}`, { method: 'PATCH', body: patch });

/** Sends the version on screen, so a draft that just changed is never sent unseen. */
export const submitDraft = (id: string, version: number) =>
  api<SubmitDraftReply>(`/ticket-drafts/${id}/submit`, { method: 'POST', body: { version } });

/** Empties the version on screen; an unsent draft only. */
export const discardDraft = (id: string, version: number) =>
  api<TicketDraft>(`/ticket-drafts/${id}/discard`, { method: 'POST', body: { version } });

export const resumableKey = ['voice', 'resumable'] as const;

/** My last call, if it dropped less than an hour ago with its ticket unsent. */
export const useResumableCall = (enabled: boolean) =>
  useQuery({
    queryKey: resumableKey,
    queryFn: () => api<VoiceCall | null>('/voice/calls/resumable'),
    enabled,
  });
