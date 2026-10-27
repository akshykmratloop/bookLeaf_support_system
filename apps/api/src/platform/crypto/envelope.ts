import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Envelope encryption for per-workspace secrets (connector API keys, signing secrets).
 *
 * Each value is encrypted with its own random 32-byte data key (AES-256-GCM); the data key is
 * wrapped with the master key (AES-256-GCM). Rotating the master key means re-wrapping data
 * keys only. The AAD binds a ciphertext to the row and field it belongs to, so a ciphertext
 * copied into another row does not decrypt.
 *
 * Stored form: `v1.<keyId>.<wrappedDek>.<iv>.<tag>.<ciphertext>` (base64url parts).
 */
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = 'v1';

export interface MasterKey {
  id: string;
  key: Buffer;
}

export interface Envelope {
  encrypt(plain: string, aad: string): string;
  decrypt(stored: string, aad: string): string;
  /** Which master key wrapped this value (to find values that need re-wrapping). */
  keyIdOf(stored: string): string;
}

export class SecretFormatError extends Error {
  constructor(reason: string) {
    super(`Stored secret is unreadable: ${reason}`);
    this.name = 'SecretFormatError';
  }
}

const b64 = (b: Buffer) => b.toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url');

function seal(key: Buffer, plain: Buffer, aad: Buffer) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(aad);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), body };
}

function open(key: Buffer, parts: { iv: Buffer; tag: Buffer; body: Buffer }, aad: Buffer) {
  const decipher = createDecipheriv(ALGO, key, parts.iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(parts.tag);
  try {
    return Buffer.concat([decipher.update(parts.body), decipher.final()]);
  } catch {
    throw new SecretFormatError('authentication failed');
  }
}

/** Parses a master key from env: base64 (standard or url), at least 32 bytes. */
export function parseMasterKey(encoded: string, id = 'k1'): MasterKey {
  const key = Buffer.from(encoded.trim(), 'base64');
  if (key.length < KEY_BYTES)
    throw new Error('SECRETS_MASTER_KEY must decode to at least 32 bytes');
  return { id, key: key.subarray(0, KEY_BYTES) };
}

function parseStored(stored: string) {
  const [version, keyId, wrapped, iv, tag, body, ...rest] = stored.split('.');
  if (version !== VERSION || !keyId || !wrapped || !iv || !tag || !body || rest.length)
    throw new SecretFormatError('bad format');
  return { keyId, wrapped: unb64(wrapped), iv: unb64(iv), tag: unb64(tag), body: unb64(body) };
}

/** Wrapped data key layout: iv (12) | tag (16) | wrapped key (32). */
function wrapDek(master: MasterKey, dek: Buffer, aad: Buffer): Buffer {
  const w = seal(master.key, dek, aad);
  return Buffer.concat([w.iv, w.tag, w.body]);
}

function unwrapDek(master: MasterKey, wrapped: Buffer, aad: Buffer): Buffer {
  if (wrapped.length !== IV_BYTES + 16 + KEY_BYTES) throw new SecretFormatError('bad key wrap');
  return open(
    master.key,
    { iv: wrapped.subarray(0, 12), tag: wrapped.subarray(12, 28), body: wrapped.subarray(28) },
    aad,
  );
}

/** An envelope that can read values wrapped by any of the given keys and writes with the first. */
export function createEnvelope(keys: readonly MasterKey[]): Envelope {
  const [current] = keys;
  if (!current) throw new Error('createEnvelope needs at least one master key');
  const byId = new Map(keys.map((k) => [k.id, k]));
  return {
    encrypt(plain, aad) {
      const aadBuf = Buffer.from(aad, 'utf8');
      const dek = randomBytes(KEY_BYTES);
      const { iv, tag, body } = seal(dek, Buffer.from(plain, 'utf8'), aadBuf);
      const wrapped = wrapDek(current, dek, aadBuf);
      return [VERSION, current.id, b64(wrapped), b64(iv), b64(tag), b64(body)].join('.');
    },
    decrypt(stored, aad) {
      const p = parseStored(stored);
      const master = byId.get(p.keyId);
      if (!master) throw new SecretFormatError(`unknown master key ${p.keyId}`);
      const aadBuf = Buffer.from(aad, 'utf8');
      const dek = unwrapDek(master, p.wrapped, aadBuf);
      return open(dek, p, aadBuf).toString('utf8');
    },
    keyIdOf: (stored) => parseStored(stored).keyId,
  };
}

/** The last characters of a secret, enough to tell keys apart and never enough to use one. */
export const hintOf = (secret: string, chars = 4) => `…${secret.slice(-chars)}`;
