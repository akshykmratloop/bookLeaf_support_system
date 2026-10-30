import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  IdParamSchema,
  ProblemSchema,
  ServerCreateTicketSchema,
  ServerMessageRequestSchema,
  ServerStatusChangeSchema,
  ServerTicketDetailSchema,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import { SERVER_WRITES_PER_MINUTE } from './limits.js';
import type { ServerApiService } from './service.js';

interface Opts {
  server: ServerApiService;
}

/** API-key calls, not browser sessions; writes have a lower limit since tickets start AI work. */
const WRITE = {
  public: true,
  rateLimit: { max: SERVER_WRITES_PER_MINUTE, timeWindow: '1 minute' },
};
const errors = {
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  409: ProblemSchema,
  422: ProblemSchema,
  429: ProblemSchema,
  503: ProblemSchema,
};
const tags = ['server'];
const security = [{ apiKey: [] }];
const IDEMPOTENT =
  'Send an `Idempotency-Key` header (a UUID) to retry safely: the same key returns the first result.';

function createTicket(app: RouteApp, server: ServerApiService) {
  app.post(
    '/server/tickets',
    {
      config: WRITE,
      schema: {
        tags,
        security,
        summary: 'Raise a ticket for one of your customers (scope tickets:write)',
        description: `Triage runs as for any ticket. 201 created, 200 for a repeated key. ${IDEMPOTENT}`,
        body: ServerCreateTicketSchema,
        response: { 201: ServerTicketDetailSchema, 200: ServerTicketDetailSchema, ...errors },
      },
    },
    async (req, reply) => {
      const { ticket, created } = await server.createTicket(req, req.body);
      return reply.status(created ? 201 : 200).send(ticket);
    },
  );
}

function addMessage(app: RouteApp, server: ServerApiService) {
  app.post(
    '/server/tickets/:id/messages',
    {
      config: WRITE,
      schema: {
        tags,
        security,
        summary: 'Add a message from the customer to their ticket (scope tickets:write)',
        description: IDEMPOTENT,
        params: IdParamSchema,
        body: ServerMessageRequestSchema,
        response: { 201: ServerTicketDetailSchema, ...errors },
      },
    },
    async (req, reply) =>
      reply.status(201).send(await server.addMessage(req, req.params.id, req.body.body)),
  );
}

function changeStatus(app: RouteApp, server: ServerApiService) {
  app.patch(
    '/server/tickets/:id',
    {
      config: WRITE,
      schema: {
        tags,
        security,
        summary: 'Resolve, close or reopen a ticket (scope tickets:write)',
        description: `Follows the ticket status rules; a move they do not allow is 409. ${IDEMPOTENT}`,
        params: IdParamSchema,
        body: ServerStatusChangeSchema,
        response: { 200: ServerTicketDetailSchema, ...errors },
      },
    },
    async (req) => server.changeStatus(req, req.params.id, req.body),
  );
}

/** Changes the workspace's own server makes with a `tickets:write` key (U-11). */
export const serverWriteRoutes: FastifyPluginAsyncZod<Opts> = async (app, { server }) => {
  createTicket(app, server);
  addMessage(app, server);
  changeStatus(app, server);
};
