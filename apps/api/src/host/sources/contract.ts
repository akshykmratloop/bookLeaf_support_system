import type { SourceSpec } from './types.js';

/**
 * The single endpoint every connection had before U-9, `{baseUrl}/support/customers/{id}` in
 * the fixed customer shape, as a data source. The default workspace on env settings uses it.
 */
export function contractSource(
  id: string,
  o: { baseUrl: string; timeoutMs: number; cacheSeconds: number },
): SourceSpec {
  return {
    id,
    name: 'Customer',
    urlTemplate: `${o.baseUrl.replace(/\/+$/, '')}/support/customers/{id}`,
    format: 'CONTRACT',
    authHeader: null,
    timeoutMs: o.timeoutMs,
    cacheSeconds: o.cacheSeconds,
  };
}
