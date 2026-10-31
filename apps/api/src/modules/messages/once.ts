import { isUniqueViolation, isUniqueViolationOn } from '../../platform/db.js';
import type { TicketDeps } from '../tickets/deps.js';

/** True when a message with this Idempotency-Key is already on the ticket. */
export async function findByKey(deps: TicketDeps, ticketId: string, key: string | null) {
  if (!key) return false;
  return (await deps.db.ticketMessage.count({ where: { ticketId, clientRequestId: key } })) > 0;
}

/** Prisma names the clashing columns only sometimes ("Unique constraint failed on the (not available)"). */
const namesNoTarget = (err: unknown) => !(err as { meta?: { target?: unknown } }).meta?.target;

/**
 * A replay that lost the insert race is not an error: the first request already wrote it. Only
 * a clash on the Idempotency-Key column counts. When Prisma cannot name the columns, the replay
 * is confirmed by the row with this key being there. Any other unique clash (an AI job
 * generation, say) is a real failure and is rethrown.
 */
export async function writeOnce(
  write: () => Promise<void>,
  isReplay: () => Promise<boolean>,
): Promise<void> {
  try {
    await write();
  } catch (err) {
    if (isUniqueViolationOn(err, 'client_request_id')) return;
    if (isUniqueViolation(err) && namesNoTarget(err) && (await isReplay())) return;
    throw err;
  }
}
