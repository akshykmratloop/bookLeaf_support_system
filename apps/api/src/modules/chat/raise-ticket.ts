import type { AuthorTicket, ChatTicketRequestSchema } from '@bookleaf/shared';
import type { z } from 'zod';
import { isUniqueViolation } from '../../platform/db.js';
import { authorIdOf, type Session } from '../auth/session.js';
import { createTicket, getAuthorTicket } from '../tickets/create.js';
import { type ChatDeps } from './deps.js';
import { findOwnSession } from './repository.js';

export interface ChatTicketInput {
  chatId: string;
  ticket: z.output<typeof ChatTicketRequestSchema>;
  idempotencyKey: string | null;
}

interface Raised {
  ticket: AuthorTicket;
  created: boolean;
}

/** One ticket per conversation, confirmed and edited by the author. */
export async function raiseChatTicket(
  deps: ChatDeps,
  session: Session,
  input: ChatTicketInput,
): Promise<Raised> {
  await deps.assistant.requireChatEnabled();
  const chat = await findOwnSession(deps.db, input.chatId, authorIdOf(session));
  if (chat.ticket)
    return { ticket: await getAuthorTicket(deps, session, chat.ticket.id), created: false };
  try {
    return await createTicket(deps, session, input.ticket, {
      idempotencyKey: input.idempotencyKey,
      origin: { source: 'CHAT', chatSessionId: chat.id },
    });
  } catch (err) {
    // Two requests raced to create the conversation's one ticket: return the winner's.
    const existing = isUniqueViolation(err)
      ? await deps.db.ticket.findUnique({ where: { chatSessionId: chat.id } })
      : null;
    if (!existing) throw err;
    return { ticket: await getAuthorTicket(deps, session, existing.id), created: false };
  }
}
