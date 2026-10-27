import type { AuditEntry, MyWorkspace, SignupRequest, SignupResponse } from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { ForbiddenError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { auditInclude, toAuditEntry, toWorkspaceDto } from './mappers.js';
import { signup } from './signup.js';

const AUDIT_PAGE = 100;

/** The signed-in staff member's workspace and the record of changes made in it. */
export function createWorkspaceService(deps: { db: Db; clock: Clock }) {
  return {
    signup: (input: SignupRequest): Promise<SignupResponse> => signup(deps, input),

    async mine(session: Session): Promise<MyWorkspace> {
      const member = await deps.db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: session.workspaceId, userId: session.userId } },
        include: { workspace: true },
      });
      if (!member) throw new ForbiddenError('You are not a member of this workspace.');
      return { workspace: toWorkspaceDto(member.workspace), role: member.role };
    },

    async audit(session: Session): Promise<{ items: AuditEntry[] }> {
      const rows = await deps.db.auditEvent.findMany({
        where: { workspaceId: session.workspaceId },
        include: auditInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: AUDIT_PAGE,
      });
      return { items: rows.map(toAuditEntry) };
    },
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
