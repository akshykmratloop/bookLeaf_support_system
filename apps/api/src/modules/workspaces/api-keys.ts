import type { ApiKey, CreateApiKeyRequest, CreatedApiKey } from '@bookleaf/shared';
import type { WorkspaceApiKey } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError, ValidationError, WorkspaceSuspendedError } from '../../platform/errors.js';
import { asPlatform } from '../../platform/tenancy.js';
import type { Session } from '../auth/session.js';

/**
 * Server-to-server keys for a workspace's product. Format `blsk_<prefix>_<secret>`: the prefix
 * is stored and shown so keys can be told apart; only the sha256 of the whole key is stored.
 */
const KEY_PREFIX = 'blsk';
const MAX_ACTIVE_KEYS = 10;

const hashKey = (plain: string) => createHash('sha256').update(plain).digest('hex');

export const toApiKeyDto = (k: WorkspaceApiKey): ApiKey => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  scopes: k.scopes,
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  revokedAt: k.revokedAt?.toISOString() ?? null,
  createdAt: k.createdAt.toISOString(),
});

export async function listApiKeys(db: Db, session: Session): Promise<ApiKey[]> {
  const rows = await db.workspaceApiKey.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toApiKeyDto);
}

/** Mints a key; the plain value is returned once and never stored. */
export async function createApiKey(
  deps: { db: Db; clock: Clock },
  session: Session,
  input: CreateApiKeyRequest,
): Promise<CreatedApiKey> {
  const { workspaceId } = session;
  const active = await deps.db.workspaceApiKey.count({ where: { workspaceId, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS)
    throw new ValidationError(`Revoke one of the ${MAX_ACTIVE_KEYS} active keys first`);
  const prefix = randomBytes(4).toString('hex');
  const plainKey = `${KEY_PREFIX}_${prefix}_${randomBytes(24).toString('base64url')}`;
  const row = await deps.db.$transaction(async (tx) => {
    const key = await tx.workspaceApiKey.create({
      data: {
        workspaceId,
        name: input.name,
        prefix: `${KEY_PREFIX}_${prefix}`,
        keyHash: hashKey(plainKey),
        scopes: input.scopes,
        createdById: session.userId,
        createdAt: deps.clock.now(),
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: session.userId,
        entityType: 'workspace_api_key',
        entityId: key.id,
        action: 'api_key.created',
        after: { name: key.name, prefix: key.prefix, scopes: key.scopes },
      },
    });
    return key;
  });
  return { key: toApiKeyDto(row), plainKey };
}

export async function revokeApiKey(
  deps: { db: Db; clock: Clock },
  session: Session,
  id: string,
): Promise<ApiKey> {
  return deps.db.$transaction(async (tx) => {
    const key = await tx.workspaceApiKey.findFirst({
      where: { id, workspaceId: session.workspaceId },
    });
    if (!key) throw new NotFoundError('API key');
    const revoked = key.revokedAt
      ? key
      : await tx.workspaceApiKey.update({ where: { id }, data: { revokedAt: deps.clock.now() } });
    await tx.auditEvent.create({
      data: {
        workspaceId: session.workspaceId,
        actorId: session.userId,
        entityType: 'workspace_api_key',
        entityId: key.id,
        action: 'api_key.revoked',
        after: { prefix: key.prefix },
      },
    });
    return toApiKeyDto(revoked);
  });
}

/**
 * The workspace and scopes a presented key grants, or null (unknown, revoked, malformed). The key
 * itself names the workspace, so this lookup runs on the platform path (S.8).
 */
export function verifyApiKey(
  deps: { db: Db; clock: Clock },
  plainKey: string,
): Promise<{ workspaceId: string; scopes: string[]; prefix: string } | null> {
  if (!plainKey.startsWith(`${KEY_PREFIX}_`) || plainKey.length > 200) return Promise.resolve(null);
  return asPlatform(async () => {
    const key = await deps.db.workspaceApiKey.findUnique({
      where: { keyHash: hashKey(plainKey) },
      include: { workspace: { select: { plan: { select: { suspendedAt: true } } } } },
    });
    if (!key || key.revokedAt) return null;
    if (key.workspace.plan?.suspendedAt) throw new WorkspaceSuspendedError();
    await deps.db.workspaceApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: deps.clock.now() },
    });
    return { workspaceId: key.workspaceId, scopes: key.scopes, prefix: key.prefix };
  });
}
