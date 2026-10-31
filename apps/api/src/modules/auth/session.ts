import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { ROLES, type WorkspaceRole } from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import { ForbiddenError, UnauthorizedError } from '../../platform/errors.js';

export const SESSION_COOKIE = 'bl_session';
/** Customer session tokens carry this audience; other tokens signed with JWT_SECRET do not. */
export const SESSION_AUDIENCE = 'bookleaf-session';

const SessionClaimsSchema = z.object({
  sub: z.uuid(),
  workspaceId: z.uuid(),
  role: z.enum(ROLES),
  authorId: z.uuid().nullable(),
  name: z.string(),
  email: z.string(),
  /** The user's session version when the token was issued (F-12). */
  sv: z.number().int().min(1),
});

export interface Session {
  userId: string;
  /** The tenant this session belongs to. Signed into the cookie; never taken from the client. */
  workspaceId: string;
  role: (typeof ROLES)[number];
  authorId: string | null;
  name: string;
  email: string;
}

/** The signed-in author's id. Admins, and sessions without an author, get 403. */
export function authorIdOf(session: Session): string {
  if (session.role !== 'AUTHOR' || !session.authorId)
    throw new ForbiddenError('This is for authors only.');
  return session.authorId;
}

/** How long one session lasts; the default is the codec's `ttlSeconds`. */
export interface SignOptions {
  ttlSeconds?: number;
}

/** Sessions as the rest of the app uses them: sign in, check on every request, sign out. */
export interface SessionCodec {
  ttlSeconds: number;
  sign(session: Session, options?: SignOptions): Promise<string>;
  verify(token: string): Promise<Session>;
  /** Ends every session of the token's user (logout). An invalid or ended token is a no-op. */
  end(token: string): Promise<void>;
  /** The session user's role in the session's workspace, or null when not a member. */
  workspaceRole(session: Session): Promise<WorkspaceRole | null>;
}

/** The signed token alone: claims plus the session version it was issued with. */
export interface SessionTokens {
  ttlSeconds: number;
  sign(session: Session, version: number, options?: SignOptions): Promise<string>;
  verify(token: string): Promise<{ session: Session; version: number }>;
}

export const sessionExpired = () =>
  new UnauthorizedError('Your session has expired. Please sign in again.');

/** The cookie's claims as a Session (the subject is the user id). */
const fromClaims = (c: z.infer<typeof SessionClaimsSchema>): Session => ({
  userId: c.sub,
  workspaceId: c.workspaceId,
  role: c.role,
  authorId: c.authorId,
  name: c.name,
  email: c.email,
});

const toClaims = ({ userId: _userId, ...rest }: Session, version: number) => ({
  ...rest,
  sv: version,
});

/** Signed (HS256) session token stored in an httpOnly cookie. Role and author id come only from here. */
export function createSessionTokens(secret: string, ttlHours: number, clock: Clock): SessionTokens {
  const key = new TextEncoder().encode(secret);
  const ttlSeconds = ttlHours * 3600;
  return {
    ttlSeconds,
    async sign(s, version, options) {
      const iat = Math.floor(clock.now().getTime() / 1000);
      return new SignJWT(toClaims(s, version))
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(s.userId)
        .setAudience(SESSION_AUDIENCE)
        .setIssuedAt(iat)
        .setExpirationTime(iat + (options?.ttlSeconds ?? ttlSeconds))
        .sign(key);
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          audience: SESSION_AUDIENCE,
          currentDate: clock.now(),
        });
        const claims = SessionClaimsSchema.parse(payload);
        return { session: fromClaims(claims), version: claims.sv };
      } catch {
        throw sessionExpired();
      }
    },
  };
}
