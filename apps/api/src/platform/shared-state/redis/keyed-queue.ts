import type { Redis } from 'ioredis';
import { z } from 'zod';
import { QueueFullError } from '../errors.js';
import type { KeyedQueue, SharedStateLog } from '../types.js';
import { QUEUE_ENTER, QUEUE_LEAVE, QUEUE_TURN } from './scripts.js';

export interface QueueTiming {
  /** How long a running task's owner may stay silent before the next number is let in. */
  leaseMs: number;
  /** How often a waiting task asks whether it is its turn. */
  pollMs: number;
  /** Keys of a line nobody has touched for this long are dropped. */
  idleMs: number;
}

export const DEFAULT_QUEUE_TIMING: QueueTiming = { leaseMs: 15_000, pollMs: 15, idleMs: 600_000 };

const ScriptNumber = z.coerce.number().int();
const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Line {
  redis: Redis;
  keys: [string, string, string];
  timing: QueueTiming;
}

async function script(line: Line, body: string, arg: number): Promise<number> {
  const { leaseMs, idleMs } = line.timing;
  const out = await line.redis.eval(body, 3, ...line.keys, arg, leaseMs, idleMs);
  return ScriptNumber.parse(out);
}

/** Waits until number `n` may run. A line that moved past it means its place was lost. */
async function waitForTurn(line: Line, n: number, key: string): Promise<void> {
  for (;;) {
    const turn = await script(line, QUEUE_TURN, n);
    if (turn === 1) return;
    if (turn === -1) throw new QueueFullError(key);
    await later(line.timing.pollMs);
  }
}

async function runInLine<T>(line: Line, n: number, task: () => Promise<T>, log: SharedStateLog) {
  const renew = setInterval(() => {
    script(line, QUEUE_TURN, n).catch((err: unknown) =>
      log.error({ err: String(err), key: line.keys[1] }, 'keyed queue: lease renewal failed'),
    );
  }, line.timing.leaseMs / 3);
  try {
    return await task();
  } finally {
    clearInterval(renew);
    await script(line, QUEUE_LEAVE, n).catch((err: unknown) =>
      log.error({ err: String(err), key: line.keys[1] }, 'keyed queue: release failed'),
    );
  }
}

/**
 * A first-come, first-served line per key, shared by every copy through Redis. A copy that dies
 * while holding the line stops renewing its lease, and the next task goes ahead after `leaseMs`.
 */
export function redisKeyedQueue(
  redis: Redis,
  base: string,
  opts: { maxWaiting: number; timing: QueueTiming; log: SharedStateLog },
): KeyedQueue {
  return async function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const slot = `{${base}:${key}}`;
    const line: Line = {
      redis,
      keys: [`${slot}:tail`, `${slot}:head`, `${slot}:lease`],
      timing: opts.timing,
    };
    const n = await script(line, QUEUE_ENTER, opts.maxWaiting);
    if (n === 0) throw new QueueFullError(key);
    await waitForTurn(line, n, key);
    return runInLine(line, n, task, opts.log);
  };
}
