import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Guards URLs supplied by tenants (connector base URLs) against server-side request forgery:
 * only http(s), https only in production, and no host that resolves to a loopback, private,
 * link-local, multicast or metadata address. The caller keeps `redirect: 'error'`.
 */
export interface SsrfPolicy {
  requireHttps: boolean;
  /** Development only: allow localhost and private ranges (e.g. the demo host). */
  allowPrivateHosts: boolean;
}

export class UnsafeUrlError extends Error {
  constructor(reason: string) {
    super(`This URL is not allowed: ${reason}`);
    this.name = 'UnsafeUrlError';
  }
}

const v4 = (ip: string) => ip.split('.').map(Number) as [number, number, number, number];

/** Ranges that are never a public product API, as [first octet, second-octet range]. */
const PRIVATE_V4: readonly [number, [number, number]][] = [
  [0, [0, 255]], // unspecified
  [10, [0, 255]], // RFC 1918
  [127, [0, 255]], // loopback
  [100, [64, 127]], // CGNAT
  [169, [254, 254]], // link-local incl. cloud metadata
  [172, [16, 31]], // RFC 1918
  [192, [168, 168]], // RFC 1918
];
const MULTICAST_FROM = 224;

/** Loopback, RFC 1918, CGNAT, link-local (incl. cloud metadata), multicast, unspecified. */
export function isPrivateV4(ip: string): boolean {
  const [a, b] = v4(ip);
  if (a >= MULTICAST_FROM) return true;
  return PRIVATE_V4.some(([first, [lo, hi]]) => a === first && b >= lo && b <= hi);
}

export function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return isPrivateV4(mapped[1]);
  return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

export const isPrivateIp = (ip: string): boolean =>
  isIP(ip) === 4 ? isPrivateV4(ip) : isPrivateV6(ip);

const isLocalName = (host: string) =>
  host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local');

function checkScheme(url: URL, policy: SsrfPolicy): void {
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new UnsafeUrlError('only http and https');
  if (policy.requireHttps && url.protocol !== 'https:') throw new UnsafeUrlError('https only');
  if (url.username || url.password) throw new UnsafeUrlError('credentials in the URL');
}

async function resolveAll(host: string): Promise<string[]> {
  try {
    return (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new UnsafeUrlError('the host name does not resolve');
  }
}

/**
 * Throws UnsafeUrlError when the URL may not be fetched. Resolves the host first, so a public
 * name pointing at an internal address is refused too.
 */
export async function assertSafeUrl(raw: string, policy: SsrfPolicy): Promise<URL> {
  const url = new URL(raw);
  checkScheme(url, policy);
  if (policy.allowPrivateHosts) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isLocalName(host)) throw new UnsafeUrlError('local host names');
  const addresses = isIP(host) ? [host] : await resolveAll(host);
  if (addresses.some(isPrivateIp)) throw new UnsafeUrlError('private or internal addresses');
  return url;
}
