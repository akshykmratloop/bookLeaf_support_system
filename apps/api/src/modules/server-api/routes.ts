import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  IdParamSchema,
  ProblemSchema,
  ServerTicketDetailSchema,
  ServerTicketPageSchema,
  ServerTicketQuerySchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import type { ServerApiService } from './service.js';

interface Opts {
  server: ServerApiService;
}

/** Not a browser session: these routes skip the cookie guard and check the API key instead. */
const SERVER = { public: true, rateLimit: { max: 120, timeWindow: '1 minute' } };
const errors = { 401: ProblemSchema, 403: ProblemSchema, 404: ProblemSchema, 422: ProblemSchema };
const tags = ['server'];
const security = [{ apiKey: [] }];

/** The workspace's own server reads its tickets with a scoped API key. */
export const serverApiRoutes: FastifyPluginAsyncZod<Opts> = async (app, { server }) => {
  app.get(
    '/server/tickets',
    {
      config: SERVER,
      schema: {
        tags,
        security,
        summary: 'Tickets of the key’s workspace, newest first (scope tickets:read)',
        querystring: ServerTicketQuerySchema,
        response: { 200: ServerTicketPageSchema, ...errors },
      },
    },
    async (req) => server.listTickets(req, req.query),
  );
  app.get(
    '/server/tickets/:id',
    {
      config: SERVER,
      schema: {
        tags,
        security,
        summary: 'One ticket and its conversation, without internal notes (scope tickets:read)',
        params: IdParamSchema,
        response: { 200: ServerTicketDetailSchema, ...errors },
      },
    },
    async (req) => server.getTicket(req, req.params.id),
  );
};
