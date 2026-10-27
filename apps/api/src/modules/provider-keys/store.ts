import type { ProviderCapability, WorkspaceProviderKey } from '@prisma/client';
import type { ProviderKey } from '@bookleaf/shared';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';

/** AAD binds a ciphertext to its workspace and capability (see platform/crypto/envelope.ts). */
export const aadFor = (workspaceId: string, capability: ProviderCapability) =>
  `provider-key:${workspaceId}:${capability}`;

export const toProviderKeyDto = (row: WorkspaceProviderKey): ProviderKey => ({
  capability: row.capability,
  provider: row.provider,
  last4: row.last4,
  updatedAt: row.updatedAt.toISOString(),
});

export const listKeys = (db: Db, workspaceId: string) =>
  db.workspaceProviderKey.findMany({ where: { workspaceId }, orderBy: { capability: 'asc' } });

/** The plain key. Decrypted values never leave the server process. */
export const decryptKey = (envelope: Envelope, row: WorkspaceProviderKey) =>
  envelope.decrypt(row.keyEnc, aadFor(row.workspaceId, row.capability));
