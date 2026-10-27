import type { Env } from '../config/index.js';
import { httpHostRecords } from './http/records.js';
import type { HostRecords } from './types.js';

/** Picks the host adapter from config. HTTP is the only real one; tests can pass their own. */
export function buildHostRecords(env: Env, now: () => number): HostRecords {
  return httpHostRecords({
    baseUrl: env.HOST_API_URL.replace(/\/+$/, ''),
    apiKey: env.HOST_API_KEY,
    timeoutMs: env.HOST_TIMEOUT_MS,
    cacheSeconds: env.HOST_CACHE_SECONDS,
    now,
  });
}
