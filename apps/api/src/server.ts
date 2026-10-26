import { buildApp } from './app.js';
import { createWorker } from './ai/jobs/worker.js';
import { createContainer } from './container.js';
import { loadEnv } from './platform/env.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const container = createContainer(env);
  const app = await buildApp(container);
  const worker = createWorker({ db: container.db, ai: container.ai, clock: container.clock, events: container.events, log: app.log }, { pollMs: env.WORKER_POLL_MS });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, 'shutting down');
    await worker.stop();
    await app.close();
    await container.db.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: env.PORT, host: env.HOST });
  if (env.WORKER_ENABLED) worker.start();
  app.log.info({ ai: container.ai.configuredProviders(), worker: env.WORKER_ENABLED }, 'BookLeaf API ready');
}

main().catch((err: unknown) => {
  console.error('Failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
