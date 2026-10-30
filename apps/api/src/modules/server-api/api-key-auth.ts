import type { FastifyRequest } from 'fastify';
import type { ApiKeyScope } from '@bookleaf/shared';
import { AppError } from '../../platform/errors.js';

export interface KeyGrant {
  workspaceId: string;
  scopes: string[];
  /** The key's visible prefix (`blsk_…`), recorded on the changes it makes. */
  prefix: string;
}

export type VerifyKey = (plainKey: string) => Promise<KeyGrant | null>;

class ApiKeyError extends AppError {
  constructor(status: 401 | 403, message: string) {
    super(status, status === 401 ? 'API_KEY_INVALID' : 'API_KEY_SCOPE', message);
  }
}

const bearer = (req: FastifyRequest) => {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice('Bearer '.length).trim() : null;
};

/** Each request's checked key, so the early check and the handler look it up only once. */
const checked = new WeakMap<FastifyRequest, KeyGrant>();

/**
 * Checks that the request carries a valid workspace API key (401 otherwise). Runs in `onRequest`,
 * before the body is read, so a caller without a key never gets a validation error.
 */
export async function authenticateKey(req: FastifyRequest, verify: VerifyKey): Promise<KeyGrant> {
  const cached = checked.get(req);
  if (cached) return cached;
  const key = bearer(req);
  const grant = key ? await verify(key) : null;
  if (!grant)
    throw new ApiKeyError(401, 'Send a valid workspace API key as "Authorization: Bearer …".');
  checked.set(req, grant);
  return grant;
}

/** Server-to-server calls carry a workspace API key; the key decides the workspace and scopes. */
export async function requireKey(
  req: FastifyRequest,
  verify: VerifyKey,
  scope: ApiKeyScope,
): Promise<KeyGrant> {
  const grant = await authenticateKey(req, verify);
  if (!grant.scopes.includes(scope))
    throw new ApiKeyError(403, `This API key does not have the "${scope}" scope.`);
  return grant;
}
