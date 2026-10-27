import type { FastifyRequest } from 'fastify';
import type { ApiKeyScope } from '@bookleaf/shared';
import { AppError } from '../../platform/errors.js';

export interface KeyGrant {
  workspaceId: string;
  scopes: string[];
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

/** Server-to-server calls carry a workspace API key; the key decides the workspace and scopes. */
export async function requireKey(
  req: FastifyRequest,
  verify: VerifyKey,
  scope: ApiKeyScope,
): Promise<KeyGrant> {
  const key = bearer(req);
  const grant = key ? await verify(key) : null;
  if (!grant)
    throw new ApiKeyError(401, 'Send a valid workspace API key as "Authorization: Bearer …".');
  if (!grant.scopes.includes(scope))
    throw new ApiKeyError(403, `This API key does not have the "${scope}" scope.`);
  return grant;
}
