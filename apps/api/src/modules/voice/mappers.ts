import {
  AdminVoiceCallSchema,
  TicketProposalSchema,
  TranscriptLineSchema,
  type AdminVoiceCall,
  type TicketDraft,
  type TranscriptLine,
  type VoiceCall,
} from '@bookleaf/shared';
import { z } from 'zod';
import { ticketRefOf } from '../tickets/ticket-ref.js';
import type { VoiceCallRow } from './repository.js';

const Lines = z.array(TranscriptLineSchema);
const SpokenCheck = AdminVoiceCallSchema.shape.spokenCheck;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toVoiceCall(c: VoiceCallRow, draft: TicketDraft | null): VoiceCall {
  const lines = Lines.safeParse(c.transcript);
  const proposal = TicketProposalSchema.safeParse(c.proposal);
  return {
    id: c.id,
    status: c.status,
    maxSeconds: c.maxSeconds,
    startedAt: iso(c.startedAt),
    endedAt: iso(c.endedAt),
    endReason: c.endReason,
    durationSeconds: c.durationSeconds,
    transcript: lines.success ? lines.data : [],
    proposal: proposal.success ? proposal.data : null,
    ticket: c.ticket ? ticketRefOf(c.ticket) : null,
    threadId: c.threadId ?? c.id,
    draft,
  };
}

/** Admins see the whole conversation: every call of the thread, in order. */
export function toAdminVoiceCall(
  c: VoiceCallRow,
  draft: TicketDraft | null,
  threadTranscript: TranscriptLine[],
): AdminVoiceCall {
  const check = SpokenCheck.safeParse(c.spokenCheck);
  return {
    ...toVoiceCall(c, draft),
    transcript: threadTranscript,
    spokenCheck: check.success ? check.data : null,
  };
}
