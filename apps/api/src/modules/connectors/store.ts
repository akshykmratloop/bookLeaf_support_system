import type { WorkspaceConnector } from '@prisma/client';
import { AppError } from '../../platform/errors.js';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/constants.js';
import { aadFor, type ConnectorConfig, type ConnectorDeps } from './deps.js';

/** Where a workspace's connector settings come from. */
export type Resolved =
  | { source: 'WORKSPACE'; config: ConnectorConfig; row: WorkspaceConnector }
  | { source: 'ENV'; config: ConnectorConfig; row: null }
  | { source: 'NONE'; config: null; row: null };

export class SecretsNotConfiguredError extends AppError {
  constructor() {
    super(
      503,
      'SECRETS_NOT_CONFIGURED',
      'The server has no SECRETS_MASTER_KEY, so workspace secrets cannot be stored.',
    );
  }
}

/** Decrypts a row into plain settings. Decrypted values never leave the server process. */
export function decryptRow(deps: ConnectorDeps, row: WorkspaceConnector): ConnectorConfig {
  if (!deps.envelope) throw new SecretsNotConfiguredError();
  return {
    baseUrl: row.baseUrl,
    signInUrl: row.signInUrl,
    apiKey: deps.envelope.decrypt(row.apiKeyEnc, aadFor(row.workspaceId, 'apiKey')),
    signingSecret: deps.envelope.decrypt(
      row.signingSecretEnc,
      aadFor(row.workspaceId, 'signingSecret'),
    ),
    timeoutMs: row.timeoutMs,
    cacheSeconds: row.cacheSeconds,
  };
}

/** A saved row wins; the default workspace without one falls back to env; others have none. */
export async function resolveConnector(
  deps: ConnectorDeps,
  workspaceId: string,
): Promise<Resolved> {
  const row = await deps.db.workspaceConnector.findUnique({ where: { workspaceId } });
  if (row) return { source: 'WORKSPACE', config: decryptRow(deps, row), row };
  if (workspaceId === DEFAULT_WORKSPACE_ID && deps.envDefaults)
    return { source: 'ENV', config: deps.envDefaults, row: null };
  return { source: 'NONE', config: null, row: null };
}
