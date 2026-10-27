import { Prisma } from '@prisma/client';
import type { AuthorTicket, ChatTicketRequestSchema } from '@bookleaf/shared';
import type { z } from 'zod';
import { ConflictError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { createTicket, getAuthorTicket } from '../tickets/create.js';
import type { TicketDeps } from '../tickets/deps.js';
import type { VoiceCallRow } from './repository.js';

/**
 * The older after-call ticket form: one ticket per ended call. Kept working while the live
 * ticket draft replaces it (expand, then contract).
 */
export async function raiseCallTicket(
  deps: TicketDeps,
  session: Session,
  call: VoiceCallRow,
  input: z.output<typeof ChatTicketRequestSchema>,
  key: string | null,
): Promise<{ ticket: AuthorTicket; created: boolean }> {
  if (call.status !== 'ENDED')
    throw new ConflictError(
      'VOICE_CALL_NOT_ENDED',
      'You can raise a ticket once the call has ended.',
    );
  if (call.ticket)
    return { ticket: await getAuthorTicket(deps, session, call.ticket.id), created: false };
  try {
    return await createTicket(deps, session, input, key, {
      source: 'VOICE',
      voiceSessionId: call.id,
    });
  } catch (err) {
    const raced = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
    const existing = raced
      ? await deps.db.ticket.findUnique({ where: { voiceSessionId: call.id } })
      : null;
    if (!existing) throw err;
    return { ticket: await getAuthorTicket(deps, session, existing.id), created: false };
  }
}
