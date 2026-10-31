import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { UnauthorizedError, WorkspaceSuspendedError } from '../../platform/errors.js';
import { asPlatform, withWorkspace } from '../../platform/tenancy.js';
import {
  createSessionTokens,
  sessionExpired,
  type Session,
  type SessionCodec,
  type SessionTokens,
} from './session.js';
import { workspaceRolesIn, type WorkspaceRoleOf } from './workspace-role.js';

/**
 * `users.session_version` (F-12 part 2). A token is valid only while the version it was issued
 * with is the user's current one. Logout bumps it here; a password change and removal from a
 * workspace bump it in the database itself (triggers in the migration), whatever code path or
 * manual SQL makes the change.
 */
export interface SessionVersions {
  /**
   * The user's current version, or null when the account no longer exists or is a staff account
   * that is no longer a member of the session's workspace (removed staff get no session at all).
   * Throws WorkspaceSuspendedError (403) while a super admin has suspended the workspace.
   */
  current(user: SessionUser): Promise<number | null>;
  /** Moves the version on, but only if it is still `from` (an ended token cannot end newer ones). */
  bumpFrom(user: SessionUser, from: number): Promise<void>;
}

/** Who a session is for. */
export type SessionUser = Pick<Session, 'userId' | 'workspaceId'>;

/**
 * Row-level security (S.8): the version check runs on every request, before the request has a
 * workspace scope, so it is one primary-key read on the platform path (a signed token names the
 * user). Bumping it (logout) is a write and runs inside the user's own workspace.
 */
export function sessionVersionsIn(db: Db): SessionVersions {
  return {
    current: ({ userId, workspaceId }) =>
      asPlatform(async () => {
        const row = await db.user.findUnique({
          where: { id: userId },
          select: {
            sessionVersion: true,
            role: true,
            memberships: { where: { workspaceId }, select: { id: true } },
            workspace: { select: { plan: { select: { suspendedAt: true } } } },
          },
        });
        if (!row || (row.role === 'ADMIN' && row.memberships.length === 0)) return null;
        // A suspended customer's staff and authors are refused on every request (U-7).
        if (row.workspace.plan?.suspendedAt) throw new WorkspaceSuspendedError();
        return row.sessionVersion;
      }),
    bumpFrom: ({ userId, workspaceId }, from) =>
      withWorkspace(workspaceId, async () => {
        await db.user.updateMany({
          where: { id: userId, sessionVersion: from },
          data: { sessionVersion: { increment: 1 } },
        });
      }),
  };
}

/** Reads a token, or null when it is invalid or expired (nothing to end). */
async function readOrNull(tokens: SessionTokens, token: string) {
  try {
    return await tokens.verify(token);
  } catch (err) {
    if (err instanceof UnauthorizedError) return null;
    throw err;
  }
}

/** Signed tokens plus the version check: one primary-key read per request, no cache. */
export function createSessionCodec(
  tokens: SessionTokens,
  versions: SessionVersions,
  workspaceRole: WorkspaceRoleOf,
): SessionCodec {
  return {
    ttlSeconds: tokens.ttlSeconds,
    async sign(session: Session, options) {
      const version = await versions.current(session);
      if (version === null) throw new UnauthorizedError('Unknown account');
      return tokens.sign(session, version, options);
    },
    async verify(token) {
      const { session, version } = await tokens.verify(token);
      if ((await versions.current(session)) !== version) throw sessionExpired();
      return session;
    },
    async end(token) {
      const read = await readOrNull(tokens, token);
      if (read) await versions.bumpFrom(read.session, read.version);
    },
    workspaceRole,
  };
}

/**
 * The app's sessions: tokens signed with JWT_SECRET, checked against `users.session_version`,
 * plus the user's workspace role for owner-only routes.
 */
export function createSessions(
  secret: string,
  ttlHours: number,
  clock: Clock,
  db: Db,
): SessionCodec {
  return createSessionCodec(
    createSessionTokens(secret, ttlHours, clock),
    sessionVersionsIn(db),
    workspaceRolesIn(db),
  );
}
