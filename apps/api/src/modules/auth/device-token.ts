import { createHash, createHmac, randomUUID } from 'node:crypto';
import { SignJWT, errors, jwtVerify } from 'jose';
import { z } from 'zod';
import type { Clock } from '../../platform/clock.js';

/** Which sign-in a device token is for: support staff, or the super admin console. */
export type LoginArea = 'staff' | 'platform';

/** A browser that signed in successfully is remembered for 90 days. */
export const DEVICE_TOKEN_DAYS = 90;
const DEVICE_TOKEN_SECONDS = DEVICE_TOKEN_DAYS * 24 * 3600;

/** Each area has its own cookie and audience, so one area's token never counts for the other. */
export const DEVICE_COOKIES: Record<LoginArea, string> = {
  staff: 'bl_device',
  platform: 'bl_platform_device',
};
const AUDIENCES: Record<LoginArea, string> = {
  staff: 'bookleaf-device',
  platform: 'bookleaf-platform-device',
};

const ClaimsSchema = z.object({ sub: z.string().length(64), jti: z.uuid() });

/** The email is never stored in the cookie: only a hash of its normalised form. */
const subjectOf = (email: string) =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

/** The cookie that remembers a device: httpOnly, first-party, sent back only to us. */
export const deviceCookieOptions = (secure: boolean) =>
  ({
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: DEVICE_TOKEN_SECONDS,
  }) as const;

export interface DeviceTokens {
  /** A token that says "this browser signed in to `email` before"; keeps `deviceId` if given. */
  issue(area: LoginArea, email: string, deviceId?: string): Promise<string>;
  /** The device id when `token` is valid for this area and this email; otherwise null. */
  deviceIdOf(area: LoginArea, email: string, token: string | undefined): Promise<string | null>;
}

/**
 * Device cookies (OWASP "device cookie" pattern): signed with a key derived from JWT_SECRET, so
 * a device token is never a valid session and a session is never a valid device token.
 */
export function createDeviceTokens(jwtSecret: string, clock: Clock): DeviceTokens {
  const key = createHmac('sha256', jwtSecret).update('login-device-token').digest();
  return {
    async issue(area, email, deviceId) {
      const iat = Math.floor(clock.now().getTime() / 1000);
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(subjectOf(email))
        .setAudience(AUDIENCES[area])
        .setJti(deviceId ?? randomUUID())
        .setIssuedAt(iat)
        .setExpirationTime(iat + DEVICE_TOKEN_SECONDS)
        .sign(key);
    },
    async deviceIdOf(area, email, token) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          audience: AUDIENCES[area],
          subject: subjectOf(email),
          currentDate: clock.now(),
        });
        return ClaimsSchema.parse(payload).jti;
      } catch (err) {
        // A forged, expired or foreign cookie is simply an unknown browser.
        if (err instanceof errors.JOSEError || err instanceof z.ZodError) return null;
        throw err;
      }
    },
  };
}
