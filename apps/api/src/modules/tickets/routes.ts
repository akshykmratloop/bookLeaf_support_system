import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { RouteApp } from '../../platform/http/route-app.js';
import { z } from 'zod';
import {
  AdminTicketListItemSchema,
  AdminTicketSchema,
  AuthorTicketListItemSchema,
  AuthorTicketSchema,
  CreateMessageRequestSchema,
  CreateTicketRequestSchema,
  IdParamSchema,
  pageOf,
  ProblemSchema,
  TicketListQuerySchema,
  UpdateTicketRequestSchema,
} from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { idempotencyKey } from '../../platform/http/idempotency.js';
import { addAdminMessage, addAuthorMessage } from '../messages/service.js';
import { createTicket } from './create.js';
import type { TicketDeps } from './deps.js';
import { getAdminTicket, getAuthorTicket, listAdminTickets, listAuthorTickets } from './queries.js';
import { retryAi, updateTicket } from './update.js';

const ADMIN = { roles: ['ADMIN'] as const };
const AUTHOR = { roles: ['AUTHOR'] as const };
/** Admin shape first: an author-shaped object never satisfies it, so authors can't receive admin fields. */
const TicketView = z.union([AdminTicketSchema, AuthorTicketSchema]);
const errors = {
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  409: ProblemSchema,
  422: ProblemSchema,
};

function listTickets(app: RouteApp, deps: TicketDeps) {
  app.get(
    '/tickets',
    {
      schema: {
        tags: ['tickets'],
        summary:
          'List tickets. Authors: own tickets, newest first. Admins: all tickets, most urgent first',
        querystring: TicketListQuerySchema,
        response: {
          200: z.union([pageOf(AdminTicketListItemSchema), pageOf(AuthorTicketListItemSchema)]),
          ...errors,
        },
      },
    },
    async (req) => {
      const session = sessionOf(req);
      return session.role === 'ADMIN'
        ? listAdminTickets(deps, session, req.query)
        : listAuthorTickets(deps, session, req.query);
    },
  );
}

function raiseTicket(app: RouteApp, deps: TicketDeps) {
  app.post(
    '/tickets',
    {
      config: AUTHOR,
      schema: {
        tags: ['tickets'],
        summary: 'Raise a support ticket (Idempotency-Key header supported)',
        body: CreateTicketRequestSchema,
        response: { 201: AuthorTicketSchema, 200: AuthorTicketSchema, ...errors },
      },
    },
    async (req, reply) => {
      const { ticket, created } = await createTicket(deps, sessionOf(req), req.body, {
        idempotencyKey: idempotencyKey(req),
      });
      return reply.status(created ? 201 : 200).send(ticket);
    },
  );
}

function getTicket(app: RouteApp, deps: TicketDeps) {
  app.get(
    '/tickets/:id',
    {
      schema: {
        tags: ['tickets'],
        summary: 'One ticket: the author view or the admin view',
        params: IdParamSchema,
        response: { 200: TicketView, ...errors },
      },
    },
    async (req) => {
      const session = sessionOf(req);
      return session.role === 'ADMIN'
        ? getAdminTicket(deps, session, req.params.id)
        : getAuthorTicket(deps, session, req.params.id);
    },
  );
}

function changeTicket(app: RouteApp, deps: TicketDeps) {
  app.patch(
    '/tickets/:id',
    {
      config: ADMIN,
      schema: {
        tags: ['tickets'],
        summary: 'Change status, category, priority or assignee (send the current version)',
        params: IdParamSchema,
        body: UpdateTicketRequestSchema,
        response: { 200: AdminTicketSchema, ...errors },
      },
    },
    async (req) => updateTicket(deps, sessionOf(req), req.params.id, req.body),
  );
}

function addMessage(app: RouteApp, deps: TicketDeps) {
  app.post(
    '/tickets/:id/messages',
    {
      schema: {
        tags: ['tickets'],
        summary: 'Author follow-up, admin reply (checked against verified facts) or internal note',
        params: IdParamSchema,
        body: CreateMessageRequestSchema,
        response: { 201: TicketView, ...errors },
      },
    },
    async (req, reply) => {
      const session = sessionOf(req);
      const message = { ...req.body, idempotencyKey: idempotencyKey(req) };
      const result =
        session.role === 'ADMIN'
          ? await addAdminMessage(deps, session, req.params.id, message)
          : await addAuthorMessage(deps, session, req.params.id, message);
      return reply.status(201).send(result);
    },
  );
}

function retryTicketAi(app: RouteApp, deps: TicketDeps) {
  app.post(
    '/tickets/:id/ai/retry',
    {
      config: { ...ADMIN, rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['tickets'],
        summary: 'Re-run AI triage for this ticket',
        params: IdParamSchema,
        response: { 202: AdminTicketSchema, ...errors },
      },
    },
    async (req, reply) =>
      reply.status(202).send(await retryAi(deps, sessionOf(req), req.params.id)),
  );
}

export const ticketRoutes: FastifyPluginAsyncZod<{ deps: TicketDeps }> = async (app, { deps }) => {
  listTickets(app, deps);
  raiseTicket(app, deps);
  getTicket(app, deps);
  changeTicket(app, deps);
  addMessage(app, deps);
  retryTicketAi(app, deps);
};
