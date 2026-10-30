import type { CustomerFieldInputSchema, CustomerField } from '@bookleaf/shared';
import type { CustomerField as Row, Prisma } from '@prisma/client';
import type { z } from 'zod';
import { isUniqueViolation, type Db } from '../../platform/db.js';
import { ConflictError, NotFoundError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';

export type FieldInput = z.output<typeof CustomerFieldInputSchema>;

export const toFieldDto = (f: Row): CustomerField => ({
  id: f.id,
  key: f.key,
  label: f.label,
  type: f.type,
  description: f.description,
  allowedValues: f.allowedValues,
  visibleToCustomer: f.visibleToCustomer,
  position: f.position,
  sourceId: f.sourceId,
  path: f.path,
  updatedAt: f.updatedAt.toISOString(),
});

const KEY_TAKEN = () =>
  new ConflictError('FIELD_KEY_TAKEN', 'A field with this key already exists in your workspace.');

function audit(session: Session, action: string, field: Row): Prisma.AuditEventCreateArgs {
  return {
    data: {
      workspaceId: session.workspaceId,
      actorId: session.userId,
      entityType: 'customer_field',
      entityId: field.id,
      action,
      after: { key: field.key, type: field.type },
    },
  };
}

/** A mapped field must point at one of this workspace's own data sources (U-9). */
async function checkSource(tx: Prisma.TransactionClient, session: Session, input: FieldInput) {
  if (!input.sourceId) return;
  const source = await tx.workspaceDataSource.findFirst({
    where: { id: input.sourceId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!source)
    throw new ValidationError('Invalid customer field', [
      { path: 'sourceId', message: 'Pick one of your data sources' },
    ]);
}

/** The workspace's customer-data schema: the facts its product sends, in display order. */
export function listFields(db: Db, session: Session): Promise<Row[]> {
  return db.customerField.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: [{ position: 'asc' }, { key: 'asc' }],
  });
}

export async function createField(db: Db, session: Session, input: FieldInput): Promise<Row> {
  try {
    return await db.$transaction(async (tx) => {
      await checkSource(tx, session, input);
      const field = await tx.customerField.create({
        data: { ...input, workspaceId: session.workspaceId },
      });
      await tx.auditEvent.create(audit(session, 'customer_field.created', field));
      return field;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw KEY_TAKEN();
    throw err;
  }
}

async function ownField(tx: Prisma.TransactionClient, session: Session, id: string) {
  const field = await tx.customerField.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!field) throw new NotFoundError('Customer field');
  return field;
}

export async function updateField(
  db: Db,
  session: Session,
  id: string,
  input: FieldInput,
): Promise<Row> {
  try {
    return await db.$transaction(async (tx) => {
      await ownField(tx, session, id);
      await checkSource(tx, session, input);
      const field = await tx.customerField.update({ where: { id }, data: input });
      await tx.auditEvent.create(audit(session, 'customer_field.updated', field));
      return field;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw KEY_TAKEN();
    throw err;
  }
}

export async function deleteField(db: Db, session: Session, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const field = await ownField(tx, session, id);
    await tx.customerField.delete({ where: { id } });
    await tx.auditEvent.create(audit(session, 'customer_field.deleted', field));
  });
}
