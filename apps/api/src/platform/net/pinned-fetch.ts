import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { Agent, fetch as undiciFetch } from 'undici';
import { isPrivateIp, UnsafeUrlError } from './ssrf.js';

/** Resolves a host name to its addresses (injectable so tests can act like a rebinding DNS). */
export type Resolve = (hostname: string) => Promise<LookupAddress[]>;

type LookupCallback = (
  err: Error | null,
  address: string | LookupAddress[],
  family?: number,
) => void;
type ConnectLookup = (
  hostname: string,
  options: { all?: boolean },
  callback: LookupCallback,
) => void;

const systemResolve: Resolve = (hostname) => dnsLookup(hostname, { all: true });

/**
 * The DNS lookup used when the connection is opened. It refuses the connection when any address
 * is private, so the address that was checked is the address that is connected to: a name that
 * passes `assertSafeUrl` and then rebinds to 127.0.0.1 is still refused.
 */
export function refusePrivateLookup(resolve: Resolve = systemResolve): ConnectLookup {
  return (hostname, options, callback) => {
    resolve(hostname)
      .then((addresses) => {
        const first = addresses[0];
        if (!first || addresses.some((a) => isPrivateIp(a.address)))
          return callback(new UnsafeUrlError('private or internal addresses'), '');
        if (options.all) return callback(null, addresses);
        return callback(null, first.address, first.family);
      })
      .catch(() => callback(new UnsafeUrlError('the host name does not resolve'), ''));
  };
}

const agentFor = (resolve: Resolve) =>
  new Agent({ connect: { lookup: refusePrivateLookup(resolve) } });
/** One connection pool for every tenant request in production (made on first use). */
let systemAgent: Agent | undefined;

export interface PinnedFetchOptions {
  /** Development only: local and private hosts allowed, so the plain fetch is used. */
  allowPrivateHosts: boolean;
  resolve?: Resolve;
}

/**
 * fetch for tenant-supplied URLs (connector data sources, webhooks): every connection goes
 * through `refusePrivateLookup`. Callers still check the URL first (`assertSafeUrl`) and keep
 * redirects off.
 */
export function pinnedFetch({ allowPrivateHosts, resolve }: PinnedFetchOptions): typeof fetch {
  if (allowPrivateHosts) return fetch;
  const dispatcher = resolve ? agentFor(resolve) : (systemAgent ??= agentFor(systemResolve));
  const guarded = (
    input: Parameters<typeof undiciFetch>[0],
    init?: Parameters<typeof undiciFetch>[1],
  ) => undiciFetch(input, { ...init, dispatcher });
  // undici's fetch is the implementation behind Node's global fetch; only the type names differ.
  return guarded as unknown as typeof fetch;
}
