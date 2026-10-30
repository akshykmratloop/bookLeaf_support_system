import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  IdParamSchema,
  ProblemSchema,
  ServerCustomerParamSchema,
  ServerTicketDetailSchema,
  ServerTicketPageSchema,
  ServerTicketQuerySchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import { SERVER_READS_PER_MINUTE } from './limits.js';
import type { ServerApiService } from './service.js';
import { serverWriteRoutes } from './write-routes.js';

interface Opts {
  server: ServerApiService;
}

/** Not a browser session: these routes skip the cookie guard and check the API key instead. */
const SERVER = {
  public: true,
  rateLimit: { max: SERVER_READS_PER_MINUTE, timeWindow: '1 minute' },
};
const errors = {
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  422: ProblemSchema,
  429: ProblemSchema,
};
const tags = ['server'];
const security = [{ apiKey: [] }];

function ticketReads(app: RouteApp, server: ServerApiService) {
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
}

function customerReads(app: RouteApp, server: ServerApiService) {
  app.get(
    '/server/customers/:customerId/tickets',
    {
      config: SERVER,
      schema: {
        tags,
        security,
        summary: 'One customer’s tickets by your customer id, newest first (scope customers:read)',
        description: '404 when support has no record of this customer in the key’s workspace.',
        params: ServerCustomerParamSchema,
        querystring: ServerTicketQuerySchema,
        response: { 200: ServerTicketPageSchema, ...errors },
      },
    },
    async (req) => server.customerTickets(req, req.params.customerId, req.query),
  );
}

/** The workspace's own server reads and changes its tickets with a scoped API key. */
export const serverApiRoutes: FastifyPluginAsyncZod<Opts> = async (app, { server }) => {
  ticketReads(app, server);
  customerReads(app, server);
  await app.register(serverWriteRoutes, { server });
};
