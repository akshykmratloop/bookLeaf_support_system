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
}

async function fetchCustomer(o: HttpHostOptions, externalId: string): Promise<Response> {
  const url = new URL(`support/customers/${encodeURIComponent(externalId)}`, `${o.baseUrl}/`);
  try {
    return await fetch(url, {
      headers: { authorization: `Bearer ${o.apiKey}`, accept: 'application/json' },
      signal: AbortSignal.timeout(o.timeoutMs),
    });
  } catch (err) {
    throw new HostUnavailableError(err instanceof Error ? err.name : 'network error');
  }
}

async function readCustomer(res: Response): Promise<HostCustomer> {
  if (res.status === 404) throw new CustomerNotFoundError();
  if (!res.ok) throw new HostUnavailableError(`status ${res.status}`);
  const parsed = HostCustomerSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new HostUnavailableError('response does not match the contract');
  return parsed.data;
}

/** Reads customers from the host's HTTP API, validated against the contract, cached briefly. */
export function httpHostRecords(o: HttpHostOptions): HostRecords {
  const cache = ttlCache<HostCustomer>(o.cacheSeconds * 1000, o.now);
  return {
    async customer(externalId) {
      const cached = cache.get(externalId);
      if (cached) return cached;
      const customer = await readCustomer(await fetchCustomer(o, externalId));
      cache.set(externalId, customer);
      return customer;
    },
  };
}
