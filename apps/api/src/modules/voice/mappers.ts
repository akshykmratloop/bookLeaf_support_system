import {
  AdminVoiceCallSchema,
  TicketProposalSchema,
  TranscriptLineSchema,
  ticketNumberLabel,
  type AdminVoiceCall,
  type VoiceCall,
} from '@bookleaf/shared';
import { z } from 'zod';
import type { VoiceCallRow } from './repository.js';

const Lines = z.array(TranscriptLineSchema);
const SpokenCheck = AdminVoiceCallSchema.shape.spokenCheck;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toVoiceCall(c: VoiceCallRow): VoiceCall {
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
    ticket: c.ticket ? { id: c.ticket.id, number: ticketNumberLabel(c.ticket.number) } : null,
  };
}

export function toAdminVoiceCall(c: VoiceCallRow): AdminVoiceCall {
  const check = SpokenCheck.safeParse(c.spokenCheck);
  return { ...toVoiceCall(c), spokenCheck: check.success ? check.data : null };
}
