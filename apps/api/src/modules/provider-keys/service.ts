import type { Prisma, ProviderCapability } from '@prisma/client';
import type { ProviderKey, ProviderKeyList, SaveProviderKey } from '@bookleaf/shared';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { SecretsNotConfiguredError } from '../connectors/store.js';
import type { KeyedProviders } from './keyed.js';
import { aadFor, listKeys, toProviderKeyDto } from './store.js';

export interface ProviderKeyDeps {
  db: Db;
  envelope: Envelope | null;
  keyed: KeyedProviders;
  /** Providers a key may be saved for, per capability. */
  providers: Record<ProviderCapability, readonly string[]>;
}

const auditOf = (
  session: Session,
  action: string,
  id: string,
  after: Prisma.InputJsonObject,
): Prisma.AuditEventCreateArgs => ({
  data: {
    workspaceId: session.workspaceId,
    actorId: session.userId,
    entityType: 'workspace_provider_key',
    entityId: id,
    action,
    after,
  },
});

function assertProvider(deps: ProviderKeyDeps, capability: ProviderCapability, provider: string) {
  if (deps.providers[capability].includes(provider)) return;
  throw new ValidationError('Unknown provider', [
    { path: 'provider', message: `Choose one of: ${deps.providers[capability].join(', ')}` },
  ]);
}

async function saveKey(
  deps: ProviderKeyDeps,
  session: Session,
  capability: ProviderCapability,
  input: SaveProviderKey,
): Promise<ProviderKey> {
  if (!deps.envelope) throw new SecretsNotConfiguredError();
  assertProvider(deps, capability, input.provider);
  const { workspaceId } = session;
  const data = {
    provider: input.provider,
    keyEnc: deps.envelope.encrypt(input.apiKey, aadFor(workspaceId, capability)),
    last4: input.apiKey.slice(-4),
    updatedById: session.userId,
  };
  const row = await deps.db.$transaction(async (tx) => {
    const saved = await tx.workspaceProviderKey.upsert({
      where: { workspaceId_capability: { workspaceId, capability } },
      create: { workspaceId, capability, ...data },
      update: data,
    });
    const after = { capability, provider: input.provider, last4: data.last4 };
    await tx.auditEvent.create(auditOf(session, 'provider_key.saved', saved.id, after));
    return saved;
  });
  deps.keyed.invalidate(workspaceId);
  return toProviderKeyDto(row);
}

async function removeKey(deps: ProviderKeyDeps, session: Session, capability: ProviderCapability) {
  const { workspaceId } = session;
  const where = { workspaceId_capability: { workspaceId, capability } };
  await deps.db.$transaction(async (tx) => {
    const row = await tx.workspaceProviderKey.findUnique({ where });
    if (!row) throw new NotFoundError('Provider key');
    await tx.workspaceProviderKey.delete({ where });
    const after = { capability, provider: row.provider };
    await tx.auditEvent.create(auditOf(session, 'provider_key.removed', row.id, after));
  });
  deps.keyed.invalidate(workspaceId);
}

/** A workspace's own AI and voice keys: saved encrypted, shown only by their last 4 characters. */
export function createProviderKeyService(deps: ProviderKeyDeps) {
  return {
    async list(session: Session): Promise<ProviderKeyList> {
      const rows = await listKeys(deps.db, session.workspaceId);
      return {
        items: rows.map(toProviderKeyDto),
        providers: { AI: [...deps.providers.AI], VOICE: [...deps.providers.VOICE] },
        secretsConfigured: deps.envelope !== null,
      };
    },
    save: (session: Session, capability: ProviderCapability, input: SaveProviderKey) =>
      saveKey(deps, session, capability, input),
    remove: (session: Session, capability: ProviderCapability) =>
      removeKey(deps, session, capability),
  };
}

export type ProviderKeyService = ReturnType<typeof createProviderKeyService>;
