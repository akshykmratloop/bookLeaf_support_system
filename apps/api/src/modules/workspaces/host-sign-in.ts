import type { AuthUser } from '@bookleaf/shared';
import { decodeJwt } from 'jose';
import type { Db } from '../../platform/db.js';
import { UnauthorizedError } from '../../platform/errors.js';
import { signInFromHost, type HostSignInDeps } from '../auth/host-login.js';
import { DEFAULT_WORKSPACE_ID } from './constants.js';

/** Which workspace a host token is for, and the secret that signs that workspace's tokens. */
export interface HostIssuer {
  workspaceId: string;
  signingSecret: string;
}

export interface HostSignInRouter {
  db: Db;
  /** The default workspace's secret from env (null once it has a connector row). */
  defaultSecret: string;
  /** A workspace's own signing secret, or null when it has no connector yet. */
  secretFor(workspaceId: string): Promise<string | null>;
}

const INVALID = () => new UnauthorizedError('This sign-in link is invalid or has expired');

/** The `iss` claim names the workspace slug. Read before verification only to pick the key. */
function issuerSlug(token: string): string | null {
  try {
    const iss = decodeJwt(token).iss;
    return typeof iss === 'string' && iss.length > 0 ? iss : null;
  } catch {
    throw INVALID();
  }
}

/**
 * Finds the workspace a host token belongs to. Tokens without `iss` belong to the default
 * workspace (today's BookLeaf setup, verified with the env secret); a workspace's own
 * connector secret wins once it is saved.
 */
export async function resolveIssuer(router: HostSignInRouter, token: string): Promise<HostIssuer> {
  const slug = issuerSlug(token);
  const workspace = slug
    ? await router.db.workspace.findUnique({ where: { slug }, select: { id: true } })
    : { id: DEFAULT_WORKSPACE_ID };
  if (!workspace) throw INVALID();
  const own = await router.secretFor(workspace.id);
  if (own) return { workspaceId: workspace.id, signingSecret: own };
  if (workspace.id === DEFAULT_WORKSPACE_ID)
    return { workspaceId: workspace.id, signingSecret: router.defaultSecret };
  throw new UnauthorizedError('This workspace has not set up its product connection yet');
}

type Base = Omit<HostSignInDeps, 'workspaceId' | 'signingSecret'>;

/** Host sign-in for every workspace: pick the issuer, then run the one-workspace sign-in. */
export function createHostSignIn(base: Base, router: HostSignInRouter) {
  return async (token: string): Promise<{ user: AuthUser; token: string }> => {
    const issuer = await resolveIssuer(router, token);
    return signInFromHost({ ...base, ...issuer }, token);
  };
}
