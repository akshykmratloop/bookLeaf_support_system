import {
  ChatFactRefSchema,
  TicketProposalSchema,
  type ChatMessage,
  type ChatSession,
} from '@bookleaf/shared';
import type { ChatMessage as ChatMessageRow } from '@prisma/client';
import { z } from 'zod';
import { toTicketDraft } from '../ticket-drafts/mappers.js';
import { ticketRefOf } from '../tickets/ticket-ref.js';
import type { SessionWithMessages } from './repository.js';

const FactsUsedSchema = z.array(ChatFactRefSchema);

export function toChatMessage(m: ChatMessageRow): ChatMessage {
  const facts = FactsUsedSchema.safeParse(m.factsUsed);
  const proposal = TicketProposalSchema.safeParse(m.proposal);
  return {
    id: m.id,
    role: m.role,
    body: m.body,
    source: m.source,
    factsUsed: facts.success ? facts.data.map((f) => ({ label: f.label, display: f.display })) : [],
    proposal: proposal.success ? proposal.data : null,
    channel: m.channel,
    callId: m.voiceSessionId,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toChatSession(s: SessionWithMessages, maxTurns: number): ChatSession {
  return {
    id: s.id,
    turnCount: s.turnCount,
    maxTurns,
    ticket: s.ticket ? ticketRefOf(s.ticket) : null,
    messages: s.messages.map(toChatMessage),
    draft: s.ticketDraft ? toTicketDraft(s.ticketDraft) : null,
    createdAt: s.createdAt.toISOString(),
  };
}
