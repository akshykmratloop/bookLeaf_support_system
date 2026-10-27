import { HostCustomerSchema, type HostCustomer } from '@bookleaf/shared';
import { CustomerNotFoundError, HostUnavailableError } from '../errors.js';
import type { HostRecords } from '../types.js';
import { ttlCache } from './cache.js';

export interface HttpHostOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  cacheSeconds: number;
  now: () => number;
  /**
   * Re-checks the address right before each request (a tenant's own connector), so a host name
   * that later resolves to an internal address is refused (DNS rebinding).
   */
  checkUrl?: (url: URL) => Promise<void>;
}

async function fetchCustomer(o: HttpHostOptions, externalId: string): Promise<Response> {
  const url = new URL(`support/customers/${encodeURIComponent(externalId)}`, `${o.baseUrl}/`);
  try {
    await o.checkUrl?.(url);
    return await fetch(url, {
      headers: { authorization: `Bearer ${o.apiKey}`, accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(o.timeoutMs),
    });
  } catch (err) {
    throw new HostUnavailableError(err instanceof Error ? err.name : 'network error');
  }
}

async function readCustomer(res: Response, externalId: string): Promise<HostCustomer> {
  if (!res.ok) {
    await res.body?.cancel();
    if (res.status === 404) throw new CustomerNotFoundError();
    throw new HostUnavailableError(`status ${res.status}`);
  }
  const parsed = HostCustomerSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new HostUnavailableError('response does not match the contract');
  if (parsed.data.id !== externalId) throw new HostUnavailableError('response is for another id');
  return parsed.data;
}

/** "." and ".." would turn into a different path once put in the URL. */
const isPathLike = (id: string) => id === '.' || id === '..';

/** Reads customers from the host's HTTP API, validated against the contract, cached briefly. */
export function httpHostRecords(o: HttpHostOptions): HostRecords {
  const cache = ttlCache<HostCustomer>(o.cacheSeconds * 1000, o.now);
  return {
    async customer(externalId) {
      if (isPathLike(externalId)) throw new CustomerNotFoundError();
      const cached = cache.get(externalId);
      if (cached) return cached;
      const customer = await readCustomer(await fetchCustomer(o, externalId), externalId);
      cache.set(externalId, customer);
      return customer;
    },
  };
}
