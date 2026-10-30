import type {
  AuditEntry,
  CreateApiKeyRequest,
  MyWorkspace,
  SignupRequest,
  SignupResponse,
} from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { ForbiddenError } from '../../platform/errors.js';
import { asPlatform } from '../../platform/tenancy.js';
import type { Session } from '../auth/session.js';
import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } from './api-keys.js';
import { auditInclude, toAuditEntry, toWorkspaceDto } from './mappers.js';
import { signup } from './signup.js';

const AUDIT_PAGE = 100;

/** The signed-in staff member's workspace and the record of changes made in it. */
export function createWorkspaceService(deps: { db: Db; clock: Clock }) {
  return {
    /** A new workspace does not exist yet, and its slug, prefix and email span the platform (S.8). */
    signup: (input: SignupRequest): Promise<SignupResponse> =>
      asPlatform(() => signup(deps, input)),

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

    apiKeys: {
      list: (s: Session) => listApiKeys(deps.db, s),
      create: (s: Session, input: CreateApiKeyRequest) => createApiKey(deps, s, input),
      revoke: (s: Session, id: string) => revokeApiKey(deps, s, id),
      verify: (plainKey: string) => verifyApiKey(deps, plainKey),
    },
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
