import type { Prisma } from '@prisma/client';
import { ValidationError } from '../../platform/errors.js';

export type Tx = Prisma.TransactionClient;

/** Serialises config writes of one workspace (list order, last-active checks) in this transaction. */
export async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM workspaces WHERE id = ${workspaceId}::uuid FOR UPDATE`;
}

/**
 * A new order must name every row of the list exactly once (no missing, extra or foreign ids),
 * so a stale screen cannot silently drop rows from the order.
 */
export function assertSameRows(currentIds: readonly string[], newOrder: readonly string[]): void {
  const current = new Set(currentIds);
  const same = newOrder.length === current.size && newOrder.every((id) => current.has(id));
  if (!same)
    throw new ValidationError('The list changed. Reload it and try again.', [
      { path: 'ids', message: 'Must list every item of this workspace exactly once' },
    ]);
}

/** The position a newly added row gets: after every existing one. */
export const nextPosition = (max: number | null | undefined) => (max ?? -1) + 1;
