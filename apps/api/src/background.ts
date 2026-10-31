import type { FastifyInstance } from 'fastify';
import { createWorker } from './ai/jobs/worker.js';
import type { Container } from './container.js';
import { ssrfPolicyFromEnv } from './modules/connectors/from-env.js';
import { failInterruptedCalls } from './modules/voice/repository.js';
import { createWebhookDispatcher } from './modules/webhooks/dispatcher.js';
import { asPlatform } from './platform/tenancy.js';

/**
 * The work the module does beside its routes, tied to the app's lifecycle so a host that
 * mounts the plugin gets it with nothing else to start or stop:
 * on ready it closes calls cut off by a restart, then starts the AI worker (WORKER_ENABLED).
 * The caller stops it on close, before the database goes away.
 */
export function runInBackground(app: FastifyInstance, c: Container): { stop(): Promise<void> } {
  const worker = createWorker(
    {
      db: c.db,
      ai: c.ai,
      clock: c.clock,
      events: c.events,
      records: c.records,
      log: app.log,
      ticketRunsPerWorkspacePerDay: c.env.AI_TICKET_RUNS_PER_WORKSPACE_PER_DAY,
    },
    {
      pollMs: c.env.WORKER_POLL_MS,
      concurrency: c.env.WORKER_CONCURRENCY,
      hostTimeoutMs: c.env.HOST_TIMEOUT_MS,
    },
  );
  const webhooks = createWebhookDispatcher(
    {
      db: c.db,
      clock: c.clock,
      envelope: c.envelope,
      ssrf: ssrfPolicyFromEnv(c.env),
      log: app.log,
    },
    { pollMs: c.env.WORKER_POLL_MS },
  );
  app.addHook('onReady', async () => {
    // Calls live in the process that holds their socket, so any left PENDING or ACTIVE died with
    // the last one. With several copies this must be scoped first (docs/architecture.md §21).
    const interrupted = await asPlatform(() => failInterruptedCalls(c.db, c.clock.now()));
    if (interrupted.count) app.log.warn({ count: interrupted.count }, 'marked interrupted calls');
    if (!c.env.WORKER_ENABLED) return;
    worker.start();
    webhooks.start();
  });
  return { stop: async () => void (await Promise.all([worker.stop(), webhooks.stop()])) };
}
