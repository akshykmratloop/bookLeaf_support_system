import type { AuthUser, LoginRequest } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { UnauthorizedError } from '../../platform/errors.js';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';
import type { Session, SessionCodec } from './session.js';


export function toAuthUser(s: Session): AuthUser {
  return { id: s.userId, email: s.email, name: s.name, role: s.role, authorId: s.authorId };
}

export function createAuthService(db: Db, sessions: SessionCodec) {
  /** Verified against when the email is unknown, so response time does not reveal which emails exist. */
  const dummyHash = hashPassword(randomUUID());
  return {
    async login(input: LoginRequest): Promise<{ user: AuthUser; token: string }> {
      const user = await db.user.findUnique({ where: { email: input.email }, include: { author: true } });
      const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash), input.password);
      if (!user || !ok) throw new UnauthorizedError('Invalid email or password');
      const session: Session = { userId: user.id, role: user.role, authorId: user.author?.id ?? null, name: user.name, email: user.email };
      return { user: toAuthUser(session), token: await sessions.sign(session) };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
