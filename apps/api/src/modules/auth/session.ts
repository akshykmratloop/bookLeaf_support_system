import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { ROLES } from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import { ForbiddenError, UnauthorizedError } from '../../platform/errors.js';

export const SESSION_COOKIE = 'bl_session';

const SessionClaimsSchema = z.object({
  sub: z.uuid(),
  workspaceId: z.uuid(),
  role: z.enum(ROLES),
  authorId: z.uuid().nullable(),
  name: z.string(),
  email: z.string(),
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

export interface SessionCodec {
  ttlSeconds: number;
  sign(session: Session): Promise<string>;
  verify(token: string): Promise<Session>;
}

/** The cookie's claims as a Session (the subject is the user id). */
const fromClaims = (c: z.infer<typeof SessionClaimsSchema>): Session => ({
  userId: c.sub,
  workspaceId: c.workspaceId,
  role: c.role,
  authorId: c.authorId,
  name: c.name,
  email: c.email,
});

const toClaims = ({ userId: _userId, ...rest }: Session) => rest;

/** Signed (HS256) session token stored in an httpOnly cookie. Role and author id come only from here. */
export function createSessionCodec(secret: string, ttlHours: number, clock: Clock): SessionCodec {
  const key = new TextEncoder().encode(secret);
  const ttlSeconds = ttlHours * 3600;
  return {
    ttlSeconds,
    async sign(s) {
      const iat = Math.floor(clock.now().getTime() / 1000);
      return new SignJWT(toClaims(s))
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(s.userId)
        .setIssuedAt(iat)
        .setExpirationTime(iat + ttlSeconds)
        .sign(key);
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          currentDate: clock.now(),
        });
        return fromClaims(SessionClaimsSchema.parse(payload));
      } catch {
        throw new UnauthorizedError('Your session has expired. Please sign in again.');
      }
    },
  };
}
