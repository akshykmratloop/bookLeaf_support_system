import type { AuthUser } from '@bookleaf/shared';
import { CustomerNotFoundError } from '../../host/errors.js';
import { syncCustomer } from '../../host/sync.js';
import type { HostRecords } from '../../host/types.js';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { UnauthorizedError } from '../../platform/errors.js';
import { verifyHostToken } from './host-token.js';
import { toAuthUser } from './service.js';
import type { Session, SessionCodec } from './session.js';
import type { UsedTokenIds } from './used-tokens.js';

export interface HostSignInDeps {
  db: Db;
  records: HostRecords;
  sessions: SessionCodec;
  clock: Clock;
  signingSecret: string;
  usedTokens: UsedTokenIds;
}

async function customerFor(records: HostRecords, externalId: string) {
  try {
    return await records.customer(externalId);
  } catch (err) {
    if (err instanceof CustomerNotFoundError) throw new UnauthorizedError('Unknown account');
    throw err;
  }
}

/**
 * An author arrives from the host product with a hand-over token. We check it (once only), read
 * who they are from the host, keep a reference row, and start our own session (role AUTHOR only).
 */
export async function signInFromHost(
  deps: HostSignInDeps,
  token: string,
): Promise<{ user: AuthUser; token: string }> {
  const claims = await verifyHostToken(token, deps.signingSecret, deps.clock.now());
  if (!deps.usedTokens.claim(claims.jti, claims.exp))
    throw new UnauthorizedError('This sign-in link has already been used');
  const customer = await customerFor(deps.records, claims.sub);
  const { userId, authorId } = await syncCustomer(deps.db, customer);
  const session: Session = {
    userId,
    role: 'AUTHOR',
    authorId,
    name: customer.name,
    email: customer.email.toLowerCase(),
  };
  return { user: toAuthUser(session), token: await deps.sessions.sign(session) };
}
