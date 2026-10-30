import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sharedChannel } from '../../src/platform/shared-state/channel.js';
import { QueueFullError } from '../../src/platform/shared-state/errors.js';
import type { SharedState, SharedStateLog } from '../../src/platform/shared-state/types.js';

/** Two running copies on one backend, and a way to let time pass for that backend. */
export interface StatePair {
  a: SharedState;
  b: SharedState;
  /** Lets `ms` pass: a real sleep on Redis, a clock step in memory. */
  pass(ms: number): Promise<void>;
}

export const quietLog = (): SharedStateLog & { warnings: string[] } => {
  const warnings: string[] = [];
  return { warnings, warn: (_d, m) => void warnings.push(m), error: (_d, m) => warnings.push(m) };
};

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Lets queued callbacks and network round trips settle. */
const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i += 1) await later(10);
};

/**
 * What every shared-state backend must do (CLAUDE.md §21.3): the in-memory one in unit tests,
 * Redis in integration tests. Each test uses fresh keys, so runs never see each other's data.
 */
export function sharedStateContract(backend: string, pair: () => StatePair) {
  describe(`shared state contract: ${backend}`, () => {
    it('delivers a message published on copy A to a subscriber on copy B, until it unsubscribes', async () => {
      const { a, b } = pair();
      const channel = `c-${randomUUID()}`;
      const got: string[] = [];
      const stop = await b.pubsub.subscribe(channel, (m) => got.push(m));
      await a.pubsub.publish(channel, 'hello');
      await until(() => got.length > 0);
      await stop();
      await a.pubsub.publish(channel, 'after');
      await later(50);
      expect(got).toEqual(['hello']);
    });

    it('lets a one-time key be claimed once across copies, and again after it expires', async () => {
      const { a, b, pass } = pair();
      const key = `k-${randomUUID()}`;
      expect(await a.claims.claim(key, 1)).toBe(true);
      expect(await b.claims.claim(key, 1)).toBe(false);
      expect(await b.claims.claim(`${key}-other`, 1)).toBe(true);
      await pass(1_100);
      expect(await b.claims.claim(key, 1)).toBe(true);
    });

    it('adds up rate counts from both copies in one window, then starts again', async () => {
      const { a, b, pass } = pair();
      const key = `r-${randomUUID()}`;
      expect((await a.counters.hit(key, 1_000)).count).toBe(1);
      expect((await b.counters.hit(key, 1_000)).count).toBe(2);
      const third = await a.counters.hit(key, 1_000);
      expect(third.count).toBe(3);
      expect(third.resetInMs).toBeGreaterThan(0);
      expect(third.resetInMs).toBeLessThanOrEqual(1_000);
      await pass(1_100);
      expect((await b.counters.hit(key, 1_000)).count).toBe(1);
    });

    it('runs one key one task at a time across copies, in arrival order; other keys in parallel', async () => {
      const { a, b } = pair();
      const name = `q-${randomUUID()}`;
      const [qa, qb] = [a.queues.create(name, 10), b.queues.create(name, 10)];
      const log: string[] = [];
      const task = (id: string, ms: number) => async () => {
        log.push(`start ${id}`);
        await later(ms);
        log.push(`end ${id}`);
        return id;
      };
      const first = qa('k', task('1', 80));
      await later(20);
      const second = qb('k', task('2', 1));
      await later(20);
      const other = qb('other', task('x', 1));
      expect(await Promise.all([first, second, other])).toEqual(['1', '2', 'x']);
      expect(log.indexOf('end x')).toBeLessThan(log.indexOf('end 1'));
      expect(log.filter((l) => !l.endsWith('x'))).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
    });

    it('keeps the line moving after a failed task, and counts the waiting limit across copies', async () => {
      const { a, b } = pair();
      const name = `q-${randomUUID()}`;
      const [qa, qb] = [a.queues.create(name, 2), b.queues.create(name, 2)];
      const failing = qa('k', async () => {
        await later(60);
        throw new Error('boom');
      });
      await later(20);
      const next = qb('k', async () => 'ok');
      await later(20);
      await expect(qa('k', async () => 'third')).rejects.toBeInstanceOf(QueueFullError);
      await expect(failing).rejects.toThrow('boom');
      await expect(next).resolves.toBe('ok');
      await expect(qb('k', async () => 'free again')).resolves.toBe('free again');
    });

    it('broadcasts a typed channel: local listeners at once, other copies once, bad messages dropped', async () => {
      const { a, b } = pair();
      const name = `ch-${randomUUID()}`;
      const log = quietLog();
      const schema = z.object({ n: z.number() });
      const [ca, cb] = [sharedChannel(a, name, schema, log), sharedChannel(b, name, schema, log)];
      await Promise.all([ca.ready, cb.ready]);
      const onA: number[] = [];
      const onB: number[] = [];
      ca.listen((m) => onA.push(m.n));
      cb.listen((m) => onB.push(m.n));
      ca.publish({ n: 1 });
      expect(onA).toEqual([1]);
      await until(() => onB.length > 0);
      await a.pubsub.publish(
        name,
        JSON.stringify({ from: 'someone', data: { n: 'not a number' } }),
      );
      await until(() => log.warnings.length >= 2);
      expect(onA).toEqual([1]);
      expect(onB).toEqual([1]);
      expect(log.warnings).toContain('shared channel: dropped a bad message');
      await Promise.all([ca.close(), cb.close()]);
    });
  });
}
