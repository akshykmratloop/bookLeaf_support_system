import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { UnauthorizedError } from '../../platform/errors.js';
import {
  createSessionTokens,
  sessionExpired,
  type Session,
  type SessionCodec,
  type SessionTokens,
} from './session.js';

/**
 * `users.session_version` (F-12 part 2). A token is valid only while the version it was issued
 * with is the user's current one. Logout bumps it here; a password change and removal from a
 * workspace bump it in the database itself (triggers in the migration), whatever code path or
 * manual SQL makes the change.
 */
export interface SessionVersions {
  /** The user's current version, or null when the account no longer exists. */
  current(userId: string): Promise<number | null>;
  /** Moves the version on, but only if it is still `from` (an ended token cannot end newer ones). */
  bumpFrom(userId: string, from: number): Promise<void>;
}

export function sessionVersionsIn(db: Db): SessionVersions {
  return {
    async current(userId) {
      const row = await db.user.findUnique({
        where: { id: userId },
        select: { sessionVersion: true },
      });
      return row?.sessionVersion ?? null;
    },
    async bumpFrom(userId, from) {
      await db.user.updateMany({
        where: { id: userId, sessionVersion: from },
        data: { sessionVersion: { increment: 1 } },
      });
    },
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
export function createSessionCodec(tokens: SessionTokens, versions: SessionVersions): SessionCodec {
  return {
    ttlSeconds: tokens.ttlSeconds,
    async sign(session: Session) {
      const version = await versions.current(session.userId);
      if (version === null) throw new UnauthorizedError('Unknown account');
      return tokens.sign(session, version);
    },
    async verify(token) {
      const { session, version } = await tokens.verify(token);
      if ((await versions.current(session.userId)) !== version) throw sessionExpired();
      return session;
    },
    async end(token) {
      const read = await readOrNull(tokens, token);
      if (read) await versions.bumpFrom(read.session.userId, read.version);
    },
  };
}

/** The app's sessions: tokens signed with JWT_SECRET, checked against `users.session_version`. */
export function createSessions(
  secret: string,
  ttlHours: number,
  clock: Clock,
  db: Db,
): SessionCodec {
  return createSessionCodec(createSessionTokens(secret, ttlHours, clock), sessionVersionsIn(db));
}
