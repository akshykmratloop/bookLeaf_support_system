import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Db } from '../db.js';

const HealthSchema = z.object({ status: z.enum(['ok', 'degraded']), database: z.enum(['ok', 'down']) });

export const healthRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get('/health', {
    config: { public: true },
    schema: { tags: ['health'], summary: 'Liveness and database check', response: { 200: HealthSchema, 503: HealthSchema } },
  }, async (req, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: 'ok' as const, database: 'ok' as const };
    } catch (err) {
      req.log.error({ err }, 'health check: database unreachable');
      return reply.status(503).send({ status: 'degraded', database: 'down' });
    }
  });
};
