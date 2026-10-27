import {
  HOST_TOKEN_AUDIENCE,
  HOST_TOKEN_MAX_SECONDS,
  HostTokenClaimsSchema,
  type HostTokenClaims,
} from '@bookleaf/shared';
import { errors, jwtVerify } from 'jose';
import { ZodError } from 'zod';
import { UnauthorizedError } from '../../platform/errors.js';

const INVALID = () => new UnauthorizedError('This sign-in link is invalid or has expired');

/**
 * Checks a hand-over token from the host: HS256 with the shared secret, meant for us, not
 * expired, and short-lived. A role claim, if any, is ignored: host users are always authors.
 */
export async function verifyHostToken(
  token: string,
  secret: string,
  now: Date,
): Promise<HostTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      audience: HOST_TOKEN_AUDIENCE,
      currentDate: now,
      maxTokenAge: `${HOST_TOKEN_MAX_SECONDS}s`,
    });
    const claims = HostTokenClaimsSchema.parse(payload);
    if (claims.exp - claims.iat > HOST_TOKEN_MAX_SECONDS) throw INVALID();
    return claims;
  } catch (err) {
    // A bad signature, audience, expiry or claim shape all mean the same thing to the user.
    if (err instanceof errors.JOSEError || err instanceof ZodError) throw INVALID();
    throw err;
  }
}
