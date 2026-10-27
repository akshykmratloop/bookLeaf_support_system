import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** A new signing secret, shown to the admin once. */
export const newSigningSecret = () => `whsec_${randomBytes(32).toString('base64url')}`;

const mac = (secret: string, timestamp: number, body: string) =>
  createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

/** `X-BookLeaf-Signature`: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`. */
export const signatureHeader = (secret: string, timestamp: number, body: string) =>
  `t=${timestamp},v1=${mac(secret, timestamp, body)}`;

/**
 * What a receiver does (also documented in docs/integration.md): recompute the HMAC, compare in
 * constant time, and refuse old timestamps so a captured request cannot be replayed later.
 */
export function verifySignature(v: {
  secret: string;
  header: string;
  body: string;
  nowSeconds: number;
  toleranceSeconds?: number;
}): boolean {
  const { secret, header, body, nowSeconds, toleranceSeconds = 300 } = v;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || Math.abs(nowSeconds - t) > toleranceSeconds || !parts.v1)
    return false;
  const expected = Buffer.from(mac(secret, t, body), 'hex');
  const given = Buffer.from(parts.v1, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
