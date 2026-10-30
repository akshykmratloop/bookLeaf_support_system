import { randomUUID } from 'node:crypto';
import type {
  KeyedQueue,
  OneTimeClaims,
  PubSub,
  RateCounters,
  SharedState,
  Unsubscribe,
} from '../types.js';
import { keyedQueue } from './keyed-queue.js';

/** Handlers per channel; delivery is synchronous, like a function call. */
function memoryPubSub(): PubSub {
  const handlers = new Map<string, Set<(message: string) => void>>();
  return {
    async publish(channel, message) {
      handlers.get(channel)?.forEach((fn) => fn(message));
    },
    async subscribe(channel, onMessage): Promise<Unsubscribe> {
      const set = handlers.get(channel) ?? new Set();
      set.add(onMessage);
      handlers.set(channel, set);
      return async () => void set.delete(onMessage);
    },
  };
}

function memoryClaims(now: () => number): OneTimeClaims {
  const expiresAt = new Map<string, number>();
  return {
    async claim(key, ttlSeconds) {
      const t = now();
      for (const [k, exp] of expiresAt) if (exp <= t) expiresAt.delete(k);
      if (expiresAt.has(key)) return false;
      expiresAt.set(key, t + ttlSeconds * 1000);
      return true;
    },
  };
}

function memoryCounters(now: () => number): RateCounters {
  const windows = new Map<string, { count: number; endsAt: number }>();
  return {
    async hit(key, windowMs) {
      const t = now();
      const current = windows.get(key);
      const live = current && current.endsAt > t ? current : { count: 0, endsAt: t + windowMs };
      const next = { count: live.count + 1, endsAt: live.endsAt };
      windows.set(key, next);
      return { count: next.count, resetInMs: next.endsAt - t };
    },
  };
}

/** The stores one process keeps; every "copy" made from it sees the same state. */
export interface MemoryBackend {
  pubsub: PubSub;
  claims: OneTimeClaims;
  counters: RateCounters;
  queues: Map<string, KeyedQueue>;
}

export function memoryBackend(now: () => number): MemoryBackend {
  return {
    pubsub: memoryPubSub(),
    claims: memoryClaims(now),
    counters: memoryCounters(now),
    queues: new Map(),
  };
}

/**
 * One running "copy" over an in-memory backend. Only for unit tests: two copies made from one
 * backend stand in for two servers on one Redis (each with its own instance id).
 */
export function memorySharedState(backend: MemoryBackend): SharedState {
  const { pubsub, claims, counters, queues } = backend;
  return {
    backend: 'memory',
    instanceId: randomUUID(),
    pubsub,
    claims,
    counters,
    queues: {
      create(name, maxWaiting) {
        const queue = queues.get(name) ?? keyedQueue(maxWaiting);
        queues.set(name, queue);
        return queue;
      },
    },
    ready: async () => undefined,
    close: async () => undefined,
  };
}
