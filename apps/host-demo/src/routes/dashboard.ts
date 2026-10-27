import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AuthorAccount } from '../data/authors.js';
import { buildDashboard } from '../dashboard/build.js';
import { DashboardSchema } from '../dashboard/schema.js';
import { signedInAccount } from '../session.js';

interface Options {
  authors: AuthorAccount[];
  signingSecret: string;
  dataAsOf: Date;
}

const ErrorSchema = z.object({ error: z.string() });

/** BookLeaf's own author dashboard data (its product, not the support module). */
export const dashboardRoutes: FastifyPluginAsyncZod<Options> = async (app, o) => {
  app.get(
    '/api/dashboard',
    { schema: { response: { 200: DashboardSchema, 401: ErrorSchema } } },
    async (req, reply) => {
      const account = await signedInAccount(req, o.authors, o.signingSecret);
      if (!account) return reply.status(401).send({ error: 'Not signed in' });
      reply.header('cache-control', 'no-store');
      return buildDashboard(account, o.dataAsOf);
    },
  );
};
