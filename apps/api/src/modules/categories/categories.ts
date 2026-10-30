import type {
  Category,
  CategoryOption,
  CreateCategorySchema,
  UpdateCategorySchema,
} from '@bookleaf/shared';
import type { Category as Row } from '@prisma/client';
import type { z } from 'zod';
import { isUniqueViolation, type Db } from '../../platform/db.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { assertSameRows, lockWorkspace, nextPosition, type Tx } from './order.js';

export type CreateCategoryInput = z.output<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.output<typeof UpdateCategorySchema>;

const ORDER = [{ position: 'asc' as const }, { createdAt: 'asc' as const }];

export const toCategoryDto = (c: Row): Category => ({
  id: c.id,
  key: c.key,
  label: c.label,
  description: c.description,
  defaultPriority: c.defaultPriority,
  slaHours: c.slaHours,
  position: c.position,
  isActive: c.isActive,
  updatedAt: c.updatedAt.toISOString(),
});

const KEY_TAKEN = () =>
  new ConflictError('CATEGORY_KEY_TAKEN', 'A category with this key already exists.');
const LAST_ACTIVE = () =>
  new ConflictError(
    'LAST_ACTIVE_CATEGORY',
    'Keep at least one active category: new tickets need somewhere to go.',
  );

async function audit(tx: Tx, session: Session, action: string, c: Row) {
  await tx.auditEvent.create({
    data: {
      workspaceId: session.workspaceId,
      actorId: session.userId,
      entityType: 'ticket_category',
      entityId: c.id,
      action,
      after: { key: c.key, label: c.label, isActive: c.isActive, position: c.position },
    },
  });
}

/** Every category of the workspace, active or not, in display order (the admin page). */
export function listCategories(db: Db, session: Session): Promise<Row[]> {
  return db.category.findMany({ where: { workspaceId: session.workspaceId }, orderBy: ORDER });
}

/** The active categories as pickers show them (staff filters, author issue types). */
export async function categoryOptions(db: Db, session: Session): Promise<CategoryOption[]> {
  return db.category.findMany({
    where: { workspaceId: session.workspaceId, isActive: true },
    orderBy: ORDER,
    select: { key: true, label: true },
  });
}

export async function createCategory(db: Db, session: Session, input: CreateCategoryInput) {
  const workspaceId = session.workspaceId;
  try {
    return await db.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);
      const last = await tx.category.aggregate({
        where: { workspaceId },
        _max: { position: true },
      });
      const c = await tx.category.create({
        data: { ...input, workspaceId, position: nextPosition(last._max.position) },
      });
      await audit(tx, session, 'ticket_category.created', c);
      return c;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw KEY_TAKEN();
    throw err;
  }
}

async function ownCategory(tx: Tx, session: Session, id: string): Promise<Row> {
  const c = await tx.category.findFirst({ where: { id, workspaceId: session.workspaceId } });
  if (!c) throw new NotFoundError('Category');
  return c;
}

/** Deactivating the workspace's last active category is refused (triage needs one). */
async function assertNotLastActive(tx: Tx, current: Row, input: UpdateCategoryInput) {
  if (input.isActive !== false || !current.isActive) return;
  const others = await tx.category.count({
    where: { workspaceId: current.workspaceId, isActive: true, id: { not: current.id } },
  });
  if (others === 0) throw LAST_ACTIVE();
}

export async function updateCategory(
  db: Db,
  session: Session,
  id: string,
  input: UpdateCategoryInput,
): Promise<Row> {
  return db.$transaction(async (tx) => {
    await lockWorkspace(tx, session.workspaceId);
    const current = await ownCategory(tx, session, id);
    await assertNotLastActive(tx, current, input);
    const c = await tx.category.update({ where: { id }, data: input });
    await audit(tx, session, 'ticket_category.updated', c);
    return c;
  });
}

/** New display order; also the order triage reads its categories in. */
export async function reorderCategories(db: Db, session: Session, ids: string[]): Promise<Row[]> {
  const workspaceId = session.workspaceId;
  await db.$transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);
    const rows = await tx.category.findMany({ where: { workspaceId }, select: { id: true } });
    assertSameRows(
      rows.map((r) => r.id),
      ids,
    );
    for (const [position, id] of ids.entries())
      await tx.category.update({ where: { id }, data: { position } });
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: session.userId,
        entityType: 'ticket_category',
        entityId: workspaceId,
        action: 'ticket_category.reordered',
        after: { ids },
      },
    });
  });
  return listCategories(db, session);
}
