import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createEnvelope, hintOf, parseMasterKey, SecretFormatError } from './envelope.js';

const master = () => parseMasterKey(randomBytes(32).toString('base64'));

describe('envelope encryption', () => {
  it('round-trips a secret under its AAD', () => {
    const env = createEnvelope([master()]);
    const stored = env.encrypt('super-secret-api-key-123456', 'ws1:apiKey');
    expect(stored.startsWith('v1.k1.')).toBe(true);
    expect(stored).not.toContain('super-secret');
    expect(env.decrypt(stored, 'ws1:apiKey')).toBe('super-secret-api-key-123456');
  });

  it('produces a different ciphertext every time (fresh data key and IV)', () => {
    const env = createEnvelope([master()]);
    expect(env.encrypt('same', 'a')).not.toBe(env.encrypt('same', 'a'));
  });

  it('refuses a ciphertext moved to another row or field (AAD mismatch)', () => {
    const env = createEnvelope([master()]);
    const stored = env.encrypt('value', 'ws1:apiKey');
    expect(() => env.decrypt(stored, 'ws2:apiKey')).toThrow(SecretFormatError);
  });

  it('refuses a tampered ciphertext', () => {
    const env = createEnvelope([master()]);
    const stored = env.encrypt('value', 'aad');
    const parts = stored.split('.');
    const body = Buffer.from(parts[5] ?? '', 'base64url');
    body[0] = (body[0] ?? 0) ^ 0xff;
    parts[5] = body.toString('base64url');
    expect(() => env.decrypt(parts.join('.'), 'aad')).toThrow(SecretFormatError);
  });

  it('refuses a value wrapped by an unknown master key, and reads after rotation', () => {
    const old = parseMasterKey(randomBytes(32).toString('base64'), 'k1');
    const next = parseMasterKey(randomBytes(32).toString('base64'), 'k2');
    const stored = createEnvelope([old]).encrypt('value', 'aad');
    expect(() => createEnvelope([next]).decrypt(stored, 'aad')).toThrow(/unknown master key/);
    const rotated = createEnvelope([next, old]);
    expect(rotated.decrypt(stored, 'aad')).toBe('value');
    expect(rotated.keyIdOf(rotated.encrypt('value', 'aad'))).toBe('k2');
  });

  it('rejects a short master key and a malformed stored value', () => {
    expect(() => parseMasterKey(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
    const env = createEnvelope([master()]);
    expect(() => env.decrypt('v0.k1.x', 'aad')).toThrow(SecretFormatError);
  });

  it('hints with the last four characters only', () => {
    expect(hintOf('abcdefgh')).toBe('…efgh');
  });
});
