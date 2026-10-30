import { EMPTY_MAPPING } from '../sources/mapping.js';
import { sourcesHostRecords } from '../sources/records.js';
import { contractSource } from '../sources/contract.js';
import type { SourcesConfig } from '../sources/types.js';
import type { HostRecords } from '../types.js';

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

/** Reads customers from one fixed-shape endpoint, validated against the contract, cached briefly. */
export function httpHostRecords(o: HttpHostOptions): HostRecords {
  const config: SourcesConfig = {
    sources: [contractSource('customer', o)],
    mapping: EMPTY_MAPPING,
    apiKey: o.apiKey,
    checkUrl: o.checkUrl,
  };
  return sourcesHostRecords(config, o.now);
}
