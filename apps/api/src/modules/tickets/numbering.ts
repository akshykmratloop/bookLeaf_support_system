import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { NotFoundError } from '../../platform/errors.js';

const TakenRow = z.object({ number: z.number().int().min(1) });

/** Every insert path that creates a ticket gets its number here. */
export type NewTicketData = Omit<Prisma.TicketUncheckedCreateInput, 'number'>;

/**
 * Takes the workspace's next ticket number (F-13). The UPDATE row-locks the workspace until the
 * caller's transaction ends, so concurrent creates in one workspace queue up (no duplicates) and a
 * rolled-back create hands its number back (no gaps). Must run inside the ticket's transaction.
 */
export async function takeTicketNumber(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<unknown[]>`
    UPDATE "workspaces" SET "next_ticket_number" = "next_ticket_number" + 1
    WHERE "id" = ${workspaceId}::uuid
    RETURNING "next_ticket_number" - 1 AS "number"`;
  if (rows.length === 0) throw new NotFoundError('Workspace');
  return TakenRow.parse(rows[0]).number;
}
