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
  /** The workspace this token was issued for, and that workspace's signing secret. */
  workspaceId: string;
  signingSecret: string;
  usedTokens: UsedTokenIds;
  /** How long a hand-over session lasts (HOST_SESSION_TTL_HOURS), shorter than staff sessions. */
  hostSessionTtlSeconds: number;
}

async function customerFor(records: HostRecords, externalId: string, workspaceId: string) {
  try {
    return await records.customer(externalId, workspaceId);
  } catch (err) {
    if (err instanceof CustomerNotFoundError) throw new UnauthorizedError('Unknown account');
    throw err;
  }
}

/**
 * An author arrives from the host product with a hand-over token. We check it, read who they are
 * from the host, use the token up (once only), keep a reference row, and start our own short
 * session (role AUTHOR only). The token is used up only after the host answered, so a host
 * outage (503) does not burn it: the author can retry with the same link. The used-token key
 * names the workspace, so two workspaces' token ids can never collide.
 */
export async function signInFromHost(
  deps: HostSignInDeps,
  token: string,
): Promise<{ user: AuthUser; token: string }> {
  const claims = await verifyHostToken(token, deps.signingSecret, deps.clock.now());
  const customer = await customerFor(deps.records, claims.sub, deps.workspaceId);
  if (!(await deps.usedTokens.claim(`${deps.workspaceId}:${claims.jti}`, claims.exp)))
    throw new UnauthorizedError('This sign-in link has already been used');
  const { userId, authorId } = await syncCustomer(deps.db, deps.workspaceId, customer);
  const session: Session = {
    userId,
    workspaceId: deps.workspaceId,
    role: 'AUTHOR',
    authorId,
    name: customer.name,
    email: customer.email.toLowerCase(),
  };
  const ttlSeconds = deps.hostSessionTtlSeconds;
  return { user: toAuthUser(session), token: await deps.sessions.sign(session, { ttlSeconds }) };
}
