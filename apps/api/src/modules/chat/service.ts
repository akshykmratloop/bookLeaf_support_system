import type { ChatTicketRequestSchema } from '@bookleaf/shared';
import type { z } from 'zod';
import { keyedQueue } from '../../platform/keyed-queue.js';
import type { Session } from '../auth/session.js';
import type { ChatDeps } from './deps.js';
import { raiseChatTicket } from './raise-ticket.js';
import { sendMessage } from './send-message.js';
import { chatTranscript, currentChat, getChat, startChat } from './sessions.js';

/** Messages of one conversation waiting to be answered (the browser sends them one by one). */
const MAX_WAITING_PER_CONVERSATION = 3;

/** The author chat: conversations, grounded answers, and the conversation's ticket. */
export function createChatService(deps: ChatDeps) {
  // One conversation is answered in order, so each answer sees the exchange before it.
  const ctx = { ...deps, inOrder: keyedQueue(MAX_WAITING_PER_CONVERSATION) };
  return {
    current: (s: Session) => currentChat(deps, s),
    start: (s: Session) => startChat(deps, s),
    get: (s: Session, id: string) => getChat(deps, s, id),
    transcript: (id: string) => chatTranscript(deps, id),
    send: (s: Session, id: string, body: string) => sendMessage(ctx, s, { chatId: id, body }),
    raiseTicket: (
      s: Session,
      id: string,
      ticket: z.output<typeof ChatTicketRequestSchema>,
      key: string | null,
    ) => raiseChatTicket(deps, s, { chatId: id, ticket, idempotencyKey: key }),
  };
}

export type ChatService = ReturnType<typeof createChatService>;
