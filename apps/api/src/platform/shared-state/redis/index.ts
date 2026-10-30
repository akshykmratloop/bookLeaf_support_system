import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { SharedStateUnavailableError } from '../errors.js';
import type { SharedState, SharedStateLog } from '../types.js';
import { DEFAULT_QUEUE_TIMING, redisKeyedQueue, type QueueTiming } from './keyed-queue.js';
import { redisClaims, redisCounters, redisPubSub } from './stores.js';

export interface RedisStateOptions {
  url: string;
  /** Every key and channel starts with it, so several apps (or test runs) can share one Redis. */
  prefix: string;
  log: SharedStateLog;
  queueTiming?: QueueTiming;
}

const CONNECT_TIMEOUT_MS = 5_000;

/** Never prints the password part of the address. */
const safeUrl = (url: string) => url.replace(/\/\/[^@/]*@/, '//***@');

function connect(url: string, role: string, log: SharedStateLog): Redis {
  const client = new Redis(url, {
    connectTimeout: CONNECT_TIMEOUT_MS,
    // A command fails after a few reconnect tries instead of hanging a request for long.
    maxRetriesPerRequest: 3,
  });
  client.on('error', (err: Error) =>
    log.error({ err: err.message, role, url: safeUrl(url) }, 'Redis connection error'),
  );
  return client;
}

async function ping(client: Redis, url: string): Promise<void> {
  try {
    await client.ping();
  } catch (err) {
    throw new SharedStateUnavailableError(
      `Cannot reach Redis at ${safeUrl(url)} (REDIS_URL): ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

/** Polite QUIT when connected; a client still trying to connect is simply stopped. */
async function disconnect(client: Redis): Promise<void> {
  if (client.status === 'end') return;
  if (client.status === 'ready') await client.quit();
  else client.disconnect();
}

/** Shared state on Redis: what production and local development run on. */
export function redisSharedState(opts: RedisStateOptions): SharedState {
  const { url, log } = opts;
  const prefix = opts.prefix.replace(/:$/, '');
  const main = connect(url, 'commands', log);
  const subscriber = connect(url, 'subscriber', log);
  const timing = opts.queueTiming ?? DEFAULT_QUEUE_TIMING;
  return {
    backend: 'redis',
    instanceId: randomUUID(),
    pubsub: redisPubSub(main, subscriber, `${prefix}:ch`, log),
    claims: redisClaims(main, `${prefix}:once`),
    counters: redisCounters(main, `${prefix}:rl`),
    queues: {
      create: (name, maxWaiting) =>
        redisKeyedQueue(main, `${prefix}:q:${name}`, { maxWaiting, timing, log }),
    },
    ready: async () => void (await Promise.all([ping(main, url), ping(subscriber, url)])),
    close: async () => void (await Promise.all([disconnect(main), disconnect(subscriber)])),
  };
}
