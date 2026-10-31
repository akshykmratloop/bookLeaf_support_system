import { buildApp } from './app.js';
import { createContainer } from './container.js';
import { loadEnv } from './config/index.js';
import { PROVIDER_CATALOG } from './ai/providers/catalog.js';
import { createShutdown, guardProcess } from './shutdown.js';

/** The standalone server: the support module on its own, with the web app and API docs. */
async function main(): Promise<void> {
  const env = loadEnv();
  const container = createContainer(env);
  const app = await buildApp(container);

  const shutdown = createShutdown({
    log: app.log,
    close: async () => {
      await app.close(); // also stops the AI worker
      await container.shared.close();
      await container.db.$disconnect();
    },
    exit: (code) => process.exit(code),
  });
  guardProcess(process, app.log, shutdown);

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(
    {
      ai: await container.ai.configuredProviders(PROVIDER_CATALOG.map((p) => p.id)),
      voice: container.voiceProvider?.id ?? 'not configured',
      worker: env.WORKER_ENABLED,
      sharedState: container.shared.state.backend,
    },
    'BookLeaf support ready',
  );
}

main().catch((err: unknown) => {
  console.error('Failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
