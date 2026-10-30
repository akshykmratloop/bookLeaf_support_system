import { randomUUID } from 'node:crypto';
import type { LoginRequest, PlatformAdmin } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { UnauthorizedError } from '../../platform/errors.js';
import { asPlatform } from '../../platform/tenancy.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { PlatformSession, PlatformSessions } from './session.js';

export const toPlatformAdmin = (s: PlatformSession): PlatformAdmin => ({
  id: s.adminId,
  email: s.email,
  name: s.name,
});

/** Super admin sign-in: email + password against platform_admins (owner connection only). */
export function createPlatformAuth(db: Db, sessions: PlatformSessions) {
  /** Checked against when the email is unknown, so timing does not reveal which emails exist. */
  const dummyHash = hashPassword(randomUUID());
  return {
    async login(input: LoginRequest): Promise<{ admin: PlatformAdmin; token: string }> {
      const row = await asPlatform(() =>
        db.platformAdmin.findUnique({ where: { email: input.email.trim().toLowerCase() } }),
      );
      const ok = await verifyPassword(row?.passwordHash ?? (await dummyHash), input.password);
      if (!row || !ok) throw new UnauthorizedError('Invalid email or password');
      const session = { adminId: row.id, email: row.email, name: row.name };
      return { admin: toPlatformAdmin(session), token: await sessions.sign(session) };
    },
    logout: (token: string) => sessions.end(token),
  };
}

export type PlatformAuth = ReturnType<typeof createPlatformAuth>;
