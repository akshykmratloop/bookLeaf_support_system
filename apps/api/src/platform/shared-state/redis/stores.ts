import type { Redis } from 'ioredis';
import { z } from 'zod';
import { SharedStateUnavailableError } from '../errors.js';
import type { OneTimeClaims, PubSub, RateCounters, SharedStateLog, Unsubscribe } from '../types.js';
import { RATE_HIT } from './scripts.js';

const RateHitResult = z.tuple([z.coerce.number().int(), z.coerce.number().int()]);

/** `SET key NX EX ttl`: only the first claim creates the key, and it expires with the token. */
export function redisClaims(redis: Redis, base: string): OneTimeClaims {
  return {
    async claim(key, ttlSeconds) {
      const ttl = Math.max(1, Math.ceil(ttlSeconds));
      return (await redis.set(`${base}:${key}`, '1', 'EX', ttl, 'NX')) === 'OK';
    },
  };
}

export function redisCounters(redis: Redis, base: string): RateCounters {
  return {
    async hit(key, windowMs) {
      const parsed = RateHitResult.safeParse(
        await redis.eval(RATE_HIT, 1, `${base}:${key}`, windowMs),
      );
      if (!parsed.success) throw new SharedStateUnavailableError('Unexpected rate counter reply');
      const [count, resetInMs] = parsed.data;
      return { count, resetInMs };
    },
    async clear(key) {
      await redis.del(`${base}:${key}`);
    },
  };
}

/**
 * Publishing uses the normal connection; listening needs its own connection, because a Redis
 * connection in subscriber mode can run no other command. ioredis re-subscribes after reconnects.
 */
export function redisPubSub(
  publisher: Redis,
  subscriber: Redis,
  base: string,
  log: SharedStateLog,
): PubSub {
  const handlers = new Map<string, Set<(message: string) => void>>();
  subscriber.on('message', (channel: string, message: string) => {
    handlers.get(channel)?.forEach((fn) => {
      try {
        fn(message);
      } catch (err) {
        log.error({ err: String(err), channel }, 'shared state: a message handler failed');
      }
    });
  });
  return {
    async publish(channel, message) {
      await publisher.publish(`${base}:${channel}`, message);
    },
    async subscribe(channel, onMessage): Promise<Unsubscribe> {
      const full = `${base}:${channel}`;
      const set = handlers.get(full) ?? new Set();
      set.add(onMessage);
      if (!handlers.has(full)) {
        handlers.set(full, set);
        await subscriber.subscribe(full);
      }
      return async () => {
        set.delete(onMessage);
        if (set.size > 0 || handlers.get(full) !== set) return;
        handlers.delete(full);
        await subscriber.unsubscribe(full);
      };
    },
  };
}
