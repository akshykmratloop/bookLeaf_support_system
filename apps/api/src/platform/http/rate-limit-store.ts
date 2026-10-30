import type { FastifyRateLimitStore, FastifyRateLimitStoreCtor } from '@fastify/rate-limit';
import type { RateCounters } from '../shared-state/types.js';

type IncrCallback = Parameters<FastifyRateLimitStore['incr']>[1];
type RouteOptions = Parameters<FastifyRateLimitStore['child']>[0] & {
  routeInfo?: { method?: string | string[]; url?: string };
};

const routeKey = (opts: RouteOptions) => {
  const method = [opts.routeInfo?.method ?? ''].flat().join(',');
  return `${method}${opts.routeInfo?.url ?? ''}-`;
};

/**
 * `@fastify/rate-limit` counting through the shared counters, so every copy of the API adds up
 * to one limit (F-19): 5 logins a minute stay 5, not 5 per copy. Each route counts on its own,
 * like the plugin's built-in stores. Fixed windows only (no `continueExceeding` / backoff; the
 * app uses neither). When the counters cannot be reached the request fails (no silent bypass).
 */
export function sharedRateLimitStore(counters: RateCounters): FastifyRateLimitStoreCtor {
  class SharedStore implements FastifyRateLimitStore {
    constructor(
      _options: unknown,
      private readonly prefix = 'global-',
    ) {}

    incr(key: string, callback: IncrCallback, timeWindow: number): void {
      counters.hit(`${this.prefix}${key}`, timeWindow).then(
        ({ count, resetInMs }) => callback(null, { current: count, ttl: resetInMs }),
        (err: unknown) => callback(err instanceof Error ? err : new Error(String(err))),
      );
    }

    child(routeOptions: RouteOptions): FastifyRateLimitStore {
      return new SharedStore(routeOptions, routeKey(routeOptions));
    }
  }
  return SharedStore;
}
