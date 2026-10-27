import { isUniqueViolation } from '../../platform/db.js';
import type { AuthorTicket, ChatTicketRequestSchema } from '@bookleaf/shared';
import type { z } from 'zod';
import { ConflictError } from '../../platform/errors.js';
import { authorIdOf, type Session } from '../auth/session.js';
import { createTicket, getAuthorTicket } from '../tickets/create.js';
import type { TicketDeps } from '../tickets/deps.js';
import { findOwnCall } from './repository.js';

export interface CallTicketInput {
  callId: string;
  ticket: z.output<typeof ChatTicketRequestSchema>;
  idempotencyKey: string | null;
}

/**
 * The older after-call ticket form: one ticket per ended call. Kept working while the live
 * ticket draft replaces it (expand, then contract).
 */
export async function raiseCallTicket(
  deps: TicketDeps,
  session: Session,
  input: CallTicketInput,
): Promise<{ ticket: AuthorTicket; created: boolean }> {
  const call = await findOwnCall(deps.db, input.callId, authorIdOf(session));
  if (call.status !== 'ENDED')
    throw new ConflictError(
      'VOICE_CALL_NOT_ENDED',
      'You can raise a ticket once the call has ended.',
    );
  if (call.ticket)
    return { ticket: await getAuthorTicket(deps, session, call.ticket.id), created: false };
  try {
    return await createTicket(deps, session, input.ticket, {
      idempotencyKey: input.idempotencyKey,
      origin: { source: 'VOICE', voiceSessionId: call.id },
    });
  } catch (err) {
    // Two requests raced to create the call's one ticket: return the winner's.
    const existing = isUniqueViolation(err)
      ? await deps.db.ticket.findUnique({ where: { voiceSessionId: call.id } })
      : null;
    if (!existing) throw err;
    return { ticket: await getAuthorTicket(deps, session, existing.id), created: false };
  }
}
