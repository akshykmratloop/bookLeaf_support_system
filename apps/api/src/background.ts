import type { FastifyInstance } from 'fastify';
import { createWorker } from './ai/jobs/worker.js';
import type { Container } from './container.js';
import { failInterruptedCalls } from './modules/voice/repository.js';

/**
 * The work the module does beside its routes, tied to the app's lifecycle so a host that
 * mounts the plugin gets it with nothing else to start or stop:
 * on ready it closes calls cut off by a restart, then starts the AI worker (WORKER_ENABLED).
 * The caller stops it on close, before the database goes away.
 */
export function runInBackground(app: FastifyInstance, c: Container): { stop(): Promise<void> } {
  const worker = createWorker(
    { db: c.db, ai: c.ai, clock: c.clock, events: c.events, records: c.records, log: app.log },
    { pollMs: c.env.WORKER_POLL_MS },
  );
  app.addHook('onReady', async () => {
    // Calls live in this process, so any left PENDING or ACTIVE died with the last one.
    const interrupted = await failInterruptedCalls(c.db, c.clock.now());
    if (interrupted.count) app.log.warn({ count: interrupted.count }, 'marked interrupted calls');
    if (c.env.WORKER_ENABLED) worker.start();
  });
  return { stop: () => worker.stop() };
}
