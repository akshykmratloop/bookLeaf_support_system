import { HOST_TOKEN_AUDIENCE, HOST_TOKEN_MAX_SECONDS } from '@bookleaf/shared';
import { randomUUID } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import type { AuthorAccount } from './data/authors.js';

const HOST_SESSION_SECONDS = 8 * 3600;
const keyOf = (secret: string) => new TextEncoder().encode(secret);

/** The short hand-over token the support module exchanges for its own session. */
export function mintSupportToken(account: AuthorAccount, secret: string): Promise<string> {
  return new SignJWT({ name: account.record.name, email: account.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(account.record.externalId)
    .setJti(randomUUID())
    .setAudience(HOST_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${HOST_TOKEN_MAX_SECONDS}s`)
    .sign(keyOf(secret));
}

/** BookLeaf's own sign-in cookie for the demo product (not shared with the support module). */
export function signHostSession(authorId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(authorId)
    .setAudience('host-demo')
    .setIssuedAt()
    .setExpirationTime(`${HOST_SESSION_SECONDS}s`)
    .sign(keyOf(secret));
}

/** The author id in a valid host session cookie, or null. */
export async function readHostSession(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, keyOf(secret), { audience: 'host-demo' });
    return payload.sub ?? null;
  } catch (err) {
    // An expired or forged cookie means "not signed in"; anything else is a real error.
    if (err instanceof errors.JOSEError) return null;
    throw err;
  }
}
