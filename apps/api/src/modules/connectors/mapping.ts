import type { RecordMapping, SaveRecordMappingRequestSchema } from '@bookleaf/shared';
import type { z } from 'zod';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { ConnectorDeps } from './deps.js';

type Input = z.output<typeof SaveRecordMappingRequestSchema>;

const NO_CONNECTOR = () =>
  new ConflictError(
    'CONNECTOR_NOT_SAVED',
    'Save the product connection with its data sources first.',
  );
const CONFLICT = () =>
  new ConflictError(
    'VERSION_CONFLICT',
    'The product connection was changed by someone else. Reload and try again.',
  );

/** Each reference must name one of this workspace's own sources (never another workspace's). */
function unknownRefs(mapping: RecordMapping, ids: Set<string>) {
  return (['name', 'email', 'items'] as const)
    .filter((key) => mapping[key] && !ids.has(mapping[key].sourceId))
    .map((key) => ({ path: `mapping.${key}.sourceId`, message: 'Pick one of your data sources' }));
}

/**
 * Saves where name, email and the item list come from (U-9, Customer data page). Bumps the
 * connector version, so every server rebuilds the customer record with the new mapping.
 */
export async function saveRecordMapping(
  deps: ConnectorDeps,
  session: Session,
  input: Input,
): Promise<void> {
  const workspaceId = session.workspaceId;
  const row = await deps.db.workspaceConnector.findUnique({ where: { workspaceId } });
  if (!row) throw NO_CONNECTOR();
  if (row.version !== input.version) throw CONFLICT();
  const sources = await deps.db.workspaceDataSource.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const errors = unknownRefs(input.mapping, new Set(sources.map((s) => s.id)));
  if (errors.length) throw new ValidationError('Invalid customer record mapping', errors);
  await deps.db.$transaction(async (tx) => {
    await tx.workspaceConnector.update({
      where: { workspaceId },
      data: {
        recordMapping: input.mapping,
        version: { increment: 1 },
        updatedById: session.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: session.userId,
        entityType: 'workspace_connector',
        entityId: row.id,
        action: 'connector.mapping_updated',
        after: input.mapping,
      },
    });
  });
}
