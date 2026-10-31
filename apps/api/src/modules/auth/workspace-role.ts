import type { WorkspaceRole } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { withWorkspace } from '../../platform/tenancy.js';
import type { SessionUser } from './session-versions.js';

/** Reads a user's role in a workspace (`workspace_members.role`). */
export type WorkspaceRoleOf = (user: SessionUser) => Promise<WorkspaceRole | null>;

/**
 * One primary-key-like read inside the session's own workspace, so row-level security (S.8)
 * limits it to that workspace's members. Null when the user is not a member (e.g. an author).
 */
export function workspaceRolesIn(db: Db): WorkspaceRoleOf {
  return ({ userId, workspaceId }) =>
    withWorkspace(workspaceId, async () => {
      const row = await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      });
      return row?.role ?? null;
    });
}
