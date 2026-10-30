import type { AuthUser, LoginRequest } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { UnauthorizedError } from '../../platform/errors.js';
import { asPlatform } from '../../platform/tenancy.js';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';
import type { Session, SessionCodec } from './session.js';

export function toAuthUser(s: Session): AuthUser {
  return { id: s.userId, email: s.email, name: s.name, role: s.role, authorId: s.authorId };
}

/** A staff email is unique across the platform (F-12), so it names at most one account. */
export const loginEmailOf = (email: string): string => email.trim().toLowerCase();

/**
 * Staff sign in only while they are a member of their workspace (F-12): removing the
 * workspace_members row ends their sessions and stops them signing in again.
 */
const mayStaffSignIn = (user: { workspaceId: string; memberships: { workspaceId: string }[] }) =>
  user.memberships.some((m) => m.workspaceId === user.workspaceId);

export function createAuthService(db: Db, sessions: SessionCodec) {
  /** Verified against when the email is unknown, so response time does not reveal which emails exist. */
  const dummyHash = hashPassword(randomUUID());
  const findAccount = async (input: LoginRequest) => {
    // Before sign-in the workspace is unknown: the email lookup spans the platform (S.8).
    const user = await asPlatform(() =>
      db.user.findUnique({
        where: { loginEmail: loginEmailOf(input.email) },
        include: { author: true, memberships: { select: { workspaceId: true } } },
      }),
    );
    const passwordOk =
      !!user?.passwordHash && (await verifyPassword(user.passwordHash, input.password));
    if (user && passwordOk && mayStaffSignIn(user)) return user;
    if (!user?.passwordHash) await verifyPassword(await dummyHash, input.password);
    return null;
  };
  return {
    async login(input: LoginRequest): Promise<{ user: AuthUser; token: string }> {
      const user = await findAccount(input);
      if (!user) throw new UnauthorizedError('Invalid email or password');
      const session: Session = {
        userId: user.id,
        workspaceId: user.workspaceId,
        role: user.role,
        authorId: user.author?.id ?? null,
        name: user.name,
        email: user.email,
      };
      return { user: toAuthUser(session), token: await sessions.sign(session) };
    },
    /** Signs the user out everywhere: every token issued before stops working (F-12). */
    logout: (token: string): Promise<void> => sessions.end(token),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
