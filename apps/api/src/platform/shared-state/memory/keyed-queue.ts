import { QueueFullError } from '../errors.js';
import type { KeyedQueue } from '../types.js';

/**
 * Runs tasks for the same key one at a time, in arrival order; different keys run in parallel.
 * In-process only: the unit-test backend. Running copies use the Redis queue (redis/keyed-queue.ts).
 */
export function keyedQueue(maxWaiting: number): KeyedQueue {
  const tails = new Map<string, Promise<void>>();
  const depth = new Map<string, number>();

  return async function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const waiting = depth.get(key) ?? 0;
    if (waiting >= maxWaiting) throw new QueueFullError(key);
    depth.set(key, waiting + 1);
    const previous = tails.get(key) ?? Promise.resolve();
    // A failed task must not block the ones behind it, so the chain ignores its outcome.
    const result = previous.then(task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, tail);
    try {
      return await result;
    } finally {
      const left = (depth.get(key) ?? 1) - 1;
      if (left === 0) depth.delete(key);
      else depth.set(key, left);
      if (tails.get(key) === tail) tails.delete(key);
    }
  };
}
