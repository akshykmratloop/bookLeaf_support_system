import type { AuditEntry, Workspace } from '@bookleaf/shared';
import type { Prisma, Workspace as WorkspaceRow } from '@prisma/client';

export const toWorkspaceDto = (w: WorkspaceRow): Workspace => ({
  id: w.id,
  slug: w.slug,
  name: w.name,
  isDefault: w.isDefault,
  createdAt: w.createdAt.toISOString(),
});

export const auditInclude = {
  actor: { select: { id: true, name: true } },
} satisfies Prisma.AuditEventInclude;
type AuditRow = Prisma.AuditEventGetPayload<{ include: typeof auditInclude }>;

export const toAuditEntry = (e: AuditRow): AuditEntry => ({
  id: e.id,
  actor: e.actor ? { id: e.actor.id, name: e.actor.name } : null,
  entityType: e.entityType,
  entityId: e.entityId,
  action: e.action,
  createdAt: e.createdAt.toISOString(),
});
