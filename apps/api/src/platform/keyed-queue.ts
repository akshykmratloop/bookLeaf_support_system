/** Too many requests are already waiting for the same key. */
export class QueueFullError extends Error {
  constructor(readonly key: string) {
    super('Too many requests waiting for the same key');
    this.name = 'QueueFullError';
  }
}

/**
 * Runs tasks for the same key one at a time, in arrival order; different keys run in parallel.
 * In-process only: correct while the API runs as a single instance (as it does today).
 */
export function keyedQueue(maxWaiting: number) {
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
