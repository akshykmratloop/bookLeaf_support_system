import { createHmac, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { ROLES } from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import { UnauthorizedError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { UsedTokenIds } from '../auth/used-tokens.js';

/** How long the browser has to open the call socket with its ticket. */
export const STREAM_TICKET_SECONDS = 60;

const AUDIENCE = 'voice-stream';

const TicketClaimsSchema = z.object({
  sub: z.uuid(),
  cid: z.uuid(),
  workspaceId: z.uuid(),
  role: z.enum(ROLES),
  authorId: z.uuid().nullable(),
  name: z.string(),
  email: z.string(),
  jti: z.uuid(),
  exp: z.number(),
});

export interface StreamTickets {
  /** A one-time pass for opening this call's socket, for when the session cookie cannot travel. */
  issue(session: Session, callId: string): Promise<string>;
  /** The session the ticket was issued to; refused when expired, replayed or for another call. */
  redeem(token: string, callId: string): Promise<Session>;
}

const refused = () =>
  new UnauthorizedError('This call link has expired. Please start the call again.');

/**
 * The web app may be served from another site than the API (e.g. a static host), so the call
 * socket cannot rely on the session cookie. The page asks for a ticket over its normal (cookie)
 * request and opens the socket with it: 60 seconds, one use, bound to one call and one session.
 * Tickets are signed with a key derived from JWT_SECRET, so a ticket is never a valid session
 * cookie and a cookie is never a valid ticket.
 */
export function createStreamTickets(
  jwtSecret: string,
  clock: Clock,
  used: UsedTokenIds,
): StreamTickets {
  const key = createHmac('sha256', jwtSecret).update('voice-stream-ticket').digest();
  return {
    async issue(session, callId) {
      const iat = Math.floor(clock.now().getTime() / 1000);
      const { userId, ...claims } = session;
      return new SignJWT({ ...claims, cid: callId })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setAudience(AUDIENCE)
        .setJti(randomUUID())
        .setIssuedAt(iat)
        .setExpirationTime(iat + STREAM_TICKET_SECONDS)
        .sign(key);
    },
    async redeem(token, callId) {
      const claims = await verify(key, token, clock).catch(() => {
        throw refused();
      });
      if (claims.cid !== callId || !used.claim(claims.jti, claims.exp)) throw refused();
      const { sub, workspaceId, role, authorId, name, email } = claims;
      return { userId: sub, workspaceId, role, authorId, name, email };
    },
  };
}

async function verify(key: Uint8Array, token: string, clock: Clock) {
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['HS256'],
    audience: AUDIENCE,
    currentDate: clock.now(),
  });
  return TicketClaimsSchema.parse(payload);
}
