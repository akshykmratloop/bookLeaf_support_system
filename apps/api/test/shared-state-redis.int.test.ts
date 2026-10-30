import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { SharedStateUnavailableError } from '../src/platform/shared-state/errors.js';
import { redisSharedState } from '../src/platform/shared-state/redis/index.js';
import { QUEUE_ENTER } from '../src/platform/shared-state/redis/scripts.js';
import type { SharedState } from '../src/platform/shared-state/types.js';
import { quietLog, sharedStateContract } from './helpers/shared-state-contract.js';

/** Real Redis (testcontainers), never a mock: two connections stand in for two servers. */
const opened: SharedState[] = [];
const open = (prefix: string, leaseMs?: number) => {
  const state = redisSharedState({
    url: inject('redisUrl'),
    prefix,
    log: quietLog(),
    ...(leaseMs ? { queueTiming: { leaseMs, pollMs: 10, idleMs: 60_000 } } : {}),
  });
  opened.push(state);
  return state;
};
afterAll(async () => {
  await Promise.all(opened.map((s) => s.close()));
});

sharedStateContract('redis', () => {
  const prefix = `contract-${randomUUID()}`;
  const pass = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  return { a: open(prefix), b: open(prefix), pass };
});

describe('shared state on Redis', () => {
  it('keeps copies with different prefixes apart', async () => {
    const [one, two] = [open(`p-${randomUUID()}`), open(`p-${randomUUID()}`)];
    expect(await one.claims.claim('same-key', 30)).toBe(true);
    expect(await two.claims.claim('same-key', 30)).toBe(true);
  });

  it('lets the line move on when the copy at its head dies without renewing its lease', async () => {
    const prefix = `dead-${randomUUID()}`;
    const raw = new Redis(inject('redisUrl'));
    const slot = `{${prefix}:q:chat:k}`;
    // A copy that took number 1 and then died: it never renews and never leaves.
    const keys = [`${slot}:tail`, `${slot}:head`, `${slot}:lease`];
    expect(await raw.eval(QUEUE_ENTER, 3, ...keys, 5, 300, 60_000)).toBe(1);
    await raw.quit();
    const queue = open(prefix, 300).queues.create('chat', 5);
    const started = performance.now();
    await expect(queue('k', async () => 'went ahead')).resolves.toBe('went ahead');
    expect(performance.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('refuses to start with a clear message when Redis cannot be reached', async () => {
    const down = redisSharedState({
      url: 'redis://127.0.0.1:1',
      prefix: 'down',
      log: quietLog(),
    });
    const ready = down.ready();
    await expect(ready).rejects.toBeInstanceOf(SharedStateUnavailableError);
    await expect(ready).rejects.toThrow(
      /Cannot reach Redis at redis:\/\/127\.0\.0\.1:1 \(REDIS_URL\)/,
    );
    await down.close();
  });
});
