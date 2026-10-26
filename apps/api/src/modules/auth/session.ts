import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { ROLES } from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import { UnauthorizedError } from '../../platform/errors.js';

export const SESSION_COOKIE = 'bl_session';

const SessionClaimsSchema = z.object({
  sub: z.uuid(),
  role: z.enum(ROLES),
  authorId: z.uuid().nullable(),
  name: z.string(),
  email: z.string(),
});

export interface Session {
  userId: string;
  role: (typeof ROLES)[number];
  authorId: string | null;
  name: string;
  email: string;
}

export interface SessionCodec {
  ttlSeconds: number;
  sign(session: Session): Promise<string>;
  verify(token: string): Promise<Session>;
}

/** Signed (HS256) session token stored in an httpOnly cookie. Role and author id come only from here. */
export function createSessionCodec(secret: string, ttlHours: number, clock: Clock): SessionCodec {
  const key = new TextEncoder().encode(secret);
  const ttlSeconds = ttlHours * 3600;
  return {
    ttlSeconds,
    async sign(s) {
      const iat = Math.floor(clock.now().getTime() / 1000);
      return new SignJWT({ role: s.role, authorId: s.authorId, name: s.name, email: s.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(s.userId)
        .setIssuedAt(iat)
        .setExpirationTime(iat + ttlSeconds)
        .sign(key);
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'], currentDate: clock.now() });
        const c = SessionClaimsSchema.parse(payload);
        return { userId: c.sub, role: c.role, authorId: c.authorId, name: c.name, email: c.email };
      } catch {
        throw new UnauthorizedError('Your session has expired. Please sign in again.');
      }
    },
  };
}
