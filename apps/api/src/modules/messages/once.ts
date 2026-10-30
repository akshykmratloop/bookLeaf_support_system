import { isUniqueViolation } from '../../platform/db.js';
import type { TicketDeps } from '../tickets/deps.js';

/** True when a message with this Idempotency-Key is already on the ticket. */
export async function findByKey(deps: TicketDeps, ticketId: string, key: string | null) {
  if (!key) return false;
  return (await deps.db.ticketMessage.count({ where: { ticketId, clientRequestId: key } })) > 0;
}

/** A replay that lost the insert race is not an error: the first request already wrote it. */
export async function writeOnce(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}
