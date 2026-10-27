import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  AuthorTicketSchema,
  EditTicketDraftSchema,
  ProblemSchema,
  SubmitTicketDraftSchema,
  TicketDraftSchema,
} from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import type { AssistantLimits } from '../assistant/limits.js';
import type { TicketDraftService } from './service.js';

const AUTHOR = { roles: ['AUTHOR'] as const };
const errors = {
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  409: ProblemSchema,
  422: ProblemSchema,
  429: ProblemSchema,
};
const SubmitReplySchema = z.object({ draft: TicketDraftSchema, ticket: AuthorTicketSchema });

const perUser = (max: number) => ({
  max,
  timeWindow: '1 minute',
  hook: 'preHandler' as const,
  keyGenerator: (req: FastifyRequest) => `drafts:${req.session?.userId ?? req.ip}`,
});

const authorIdOf = (req: FastifyRequest) => sessionOf(req).authorId ?? '';

interface Deps {
  drafts: TicketDraftService;
  limits: AssistantLimits;
}

/** Reading and editing my draft. */
function registerReadAndEdit(app: RouteApp, { drafts, limits }: Deps) {
  app.get(
    '/ticket-drafts/chat/:sessionId',
    {
      config: { ...AUTHOR, rateLimit: perUser(limits.drafts.editsPerMinute) },
      schema: {
        tags: ['ticket-drafts'],
        summary: 'The ticket draft of one of my chat conversations (created on first use)',
        params: z.object({ sessionId: z.uuid() }),
        response: { 200: TicketDraftSchema, ...errors },
      },
    },
    async (req) => drafts.forChat(authorIdOf(req), req.params.sessionId),
  );

  app.patch(
    '/ticket-drafts/:id',
    {
      config: { ...AUTHOR, rateLimit: perUser(limits.drafts.editsPerMinute) },
      schema: {
        tags: ['ticket-drafts'],
        summary: 'Change some fields of my ticket draft; a live call hears about it',
        params: z.object({ id: z.uuid() }),
        body: EditTicketDraftSchema,
        response: { 200: TicketDraftSchema, ...errors },
      },
    },
    async (req) => drafts.edit(authorIdOf(req), req.params.id, req.body, 'AUTHOR'),
  );
}

/** Sending my draft as a ticket. */
function registerSubmit(app: RouteApp, { drafts, limits }: Deps) {
  app.post(
    '/ticket-drafts/:id/submit',
    {
      config: { ...AUTHOR, rateLimit: perUser(limits.drafts.editsPerMinute) },
      schema: {
        tags: ['ticket-drafts'],
        summary: 'Send my ticket draft as a ticket (once; repeating returns the same ticket)',
        params: z.object({ id: z.uuid() }),
        body: SubmitTicketDraftSchema,
        response: { 200: SubmitReplySchema, 201: SubmitReplySchema, ...errors },
      },
    },
    async (req, reply) => {
      const res = await drafts.submit(sessionOf(req), req.params.id, {
        by: 'AUTHOR',
        version: req.body.version,
      });
      return reply.status(res.created ? 201 : 200).send({ draft: res.draft, ticket: res.ticket });
    },
  );
}

export const ticketDraftRoutes: FastifyPluginAsyncZod<Deps> = async (app, deps) => {
  registerReadAndEdit(app, deps);
  registerSubmit(app, deps);
};
