import type { PlatformProviderKey, ProviderCapability } from '@prisma/client';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';

/** AAD binds a ciphertext to its capability and provider (see platform/crypto/envelope.ts). */
export const platformKeyAad = (capability: ProviderCapability, provider: string) =>
  `platform-key:${capability}:${provider}`;

export const listPlatformKeys = (db: Db): Promise<PlatformProviderKey[]> =>
  asPlatform(() => db.platformProviderKey.findMany({ orderBy: [{ capability: 'asc' }] }));

/** The plain key; decrypted values never leave the server process. */
export const decryptPlatformKey = (envelope: Envelope, row: PlatformProviderKey) =>
  envelope.decrypt(row.keyEnc, platformKeyAad(row.capability, row.provider));

export async function savePlatformKey(
  db: Db,
  envelope: Envelope,
  key: { capability: ProviderCapability; provider: string; apiKey: string },
): Promise<PlatformProviderKey> {
  const { capability, provider, apiKey } = key;
  const data = {
    keyEnc: envelope.encrypt(apiKey, platformKeyAad(capability, provider)),
    last4: apiKey.slice(-4),
  };
  return asPlatform(() =>
    db.platformProviderKey.upsert({
      where: { capability_provider: { capability, provider } },
      create: { capability, provider, ...data },
      update: data,
    }),
  );
}

/** False when there was no such key. */
export async function removePlatformKey(
  db: Db,
  capability: ProviderCapability,
  provider: string,
): Promise<boolean> {
  const res = await asPlatform(() =>
    db.platformProviderKey.deleteMany({ where: { capability, provider } }),
  );
  return res.count > 0;
}
