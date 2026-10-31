import type { FastifyBaseLogger } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '../db.js';

const Status = z.enum(['ok', 'down']);

const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: Status,
  redis: Status,
});

/** The shared-state backend's own check (`SharedState.ready()`): a Redis PING. */
export interface HealthSharedState {
  ready(): Promise<void>;
}

export interface HealthOptions {
  db: Db;
  shared: HealthSharedState;
}

type Check = z.infer<typeof Status>;

async function probe(what: string, log: FastifyBaseLogger, run: () => Promise<unknown>) {
  try {
    await run();
    return 'ok' satisfies Check;
  } catch (err) {
    log.error({ err }, `health check: ${what} unreachable`);
    return 'down' satisfies Check;
  }
}

/** Ready only when both the database and Redis answer; either one down is a 503. */
export const healthRoutes: FastifyPluginAsyncZod<HealthOptions> = async (app, { db, shared }) => {
  app.get(
    '/health',
    {
      config: { public: true },
      schema: {
        tags: ['health'],
        summary: 'Liveness, database and Redis check',
        response: { 200: HealthSchema, 503: HealthSchema },
      },
    },
    async (req, reply) => {
      const [database, redis] = await Promise.all([
        probe('database', req.log, () => db.$queryRaw`SELECT 1`),
        probe('redis', req.log, () => shared.ready()),
      ]);
      const healthy = database === 'ok' && redis === 'ok';
      return reply
        .status(healthy ? 200 : 503)
        .send({ status: healthy ? 'ok' : 'degraded', database, redis });
    },
  );
};
