import { describe, expect, it } from 'vitest';
import { backoffMs } from './dispatcher.js';
import { newSigningSecret, signatureHeader, verifySignature } from './signing.js';

const secret = newSigningSecret();
const body = '{"type":"ticket.created"}';
const t = 1_800_000_000;

describe('webhook signatures', () => {
  it('verifies its own signature and refuses a changed body or another secret', () => {
    const header = signatureHeader(secret, t, body);
    expect(verifySignature({ secret, header, body, nowSeconds: t })).toBe(true);
    expect(verifySignature({ secret, header, body: `${body} `, nowSeconds: t })).toBe(false);
    expect(verifySignature({ secret: newSigningSecret(), header, body, nowSeconds: t })).toBe(
      false,
    );
  });

  it('refuses a replay older than five minutes and a malformed header', () => {
    const header = signatureHeader(secret, t, body);
    expect(verifySignature({ secret, header, body, nowSeconds: t + 301 })).toBe(false);
    expect(verifySignature({ secret, header: 't=abc,v1=00', body, nowSeconds: t })).toBe(false);
    expect(verifySignature({ secret, header: '', body, nowSeconds: t })).toBe(false);
  });
});

describe('retry backoff', () => {
  it('doubles from 30 seconds and adds at most 20% jitter', () => {
    expect(backoffMs(1, () => 0)).toBe(30_000);
    expect(backoffMs(3, () => 0)).toBe(120_000);
    expect(backoffMs(3, () => 1)).toBe(144_000);
  });
});
