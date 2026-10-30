import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { UnauthorizedError } from '../../platform/errors.js';
import { asPlatform } from '../../platform/tenancy.js';

/**
 * Super admin sessions (U-7): their own cookie and token audience, so a customer token can never
 * open the console and a console token can never open a customer API. Like customer sessions,
 * a token carries the account's session version; logout and a password change move it on.
 */
export const PLATFORM_COOKIE = 'bl_platform';
const AUDIENCE = 'bookleaf-platform';

export interface PlatformSession {
  adminId: string;
  email: string;
  name: string;
}

const ClaimsSchema = z.object({
  sub: z.uuid(),
  email: z.string(),
  name: z.string(),
  sv: z.number().int().min(1),
});

const expired = () =>
  new UnauthorizedError('Your console session has ended. Please sign in again.');

export interface PlatformSessions {
  ttlSeconds: number;
  sign(session: PlatformSession): Promise<string>;
  verify(token: string): Promise<PlatformSession>;
  /** Ends every console session of the token's admin (logout). Invalid tokens are a no-op. */
  end(token: string): Promise<void>;
}

const currentVersion = (db: Db, adminId: string) =>
  asPlatform(async () => {
    const row = await db.platformAdmin.findUnique({
      where: { id: adminId },
      select: { sessionVersion: true },
    });
    return row?.sessionVersion ?? null;
  });

async function readToken(key: Uint8Array, token: string, now: Date) {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      audience: AUDIENCE,
      currentDate: now,
    });
    return ClaimsSchema.parse(payload);
  } catch {
    return null;
  }
}

/** HS256 tokens with the console's own audience, checked against platform_admins.session_version. */
export function createPlatformSessions(
  secret: string,
  ttlHours: number,
  clock: Clock,
  db: Db,
): PlatformSessions {
  const key = new TextEncoder().encode(secret);
  const ttlSeconds = ttlHours * 3600;
  return {
    ttlSeconds,
    async sign(s) {
      const version = await currentVersion(db, s.adminId);
      if (version === null) throw new UnauthorizedError('Unknown account');
      const iat = Math.floor(clock.now().getTime() / 1000);
      return new SignJWT({ email: s.email, name: s.name, sv: version })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(s.adminId)
        .setAudience(AUDIENCE)
        .setIssuedAt(iat)
        .setExpirationTime(iat + ttlSeconds)
        .sign(key);
    },
    async verify(token) {
      const claims = await readToken(key, token, clock.now());
      if (!claims || (await currentVersion(db, claims.sub)) !== claims.sv) throw expired();
      return { adminId: claims.sub, email: claims.email, name: claims.name };
    },
    async end(token) {
      const claims = await readToken(key, token, clock.now());
      if (!claims) return;
      await asPlatform(() =>
        db.platformAdmin.updateMany({
          where: { id: claims.sub, sessionVersion: claims.sv },
          data: { sessionVersion: { increment: 1 } },
        }),
      );
    },
  };
}
