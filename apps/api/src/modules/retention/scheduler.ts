import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { asPlatform } from '../../platform/tenancy.js';
import { purgeOldRows, type PurgeResult } from './purge.js';

export interface RetentionDeps {
  db: Db;
  clock: Clock;
  log: { info(o: object, msg: string): void; error(o: object, msg: string): void };
}

export interface RetentionTiming {
  /** Wait after start-up, so a deploy's first minute is not spent deleting. */
  firstRunMs: number;
  everyMs: number;
}

export const RETENTION_TIMING: RetentionTiming = { firstRunMs: 60_000, everyMs: 86_400_000 };

/**
 * Runs the retention pass a minute after start-up and then once a day. Every copy with the
 * worker on may run it: the batched DELETEs are safe to run twice, the second simply finds less.
 */
export function createRetention(deps: RetentionDeps, timing: RetentionTiming = RETENTION_TIMING) {
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<void> | null = null;

  const runOnce = (): Promise<PurgeResult> =>
    asPlatform(() => purgeOldRows(deps.db, deps.clock.now()));

  const pass = async () => {
    try {
      const removed = await runOnce();
      deps.log.info({ removed }, 'retention pass finished');
    } catch (err) {
      deps.log.error({ err }, 'retention pass failed');
    }
  };

  const schedule = (ms: number) => {
    timer = setTimeout(() => {
      running = pass().finally(() => {
        running = null;
        if (timer) schedule(timing.everyMs);
      });
    }, ms);
    timer.unref();
  };

  return {
    start() {
      if (!timer) schedule(timing.firstRunMs);
    },
    async stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      await running;
    },
    runOnce,
  };
}
