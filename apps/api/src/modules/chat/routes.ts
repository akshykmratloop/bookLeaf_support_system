import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  AuthorTicketSchema,
  ChatReplySchema,
  ChatSessionSchema,
  ChatTicketRequestSchema,
  ChatTranscriptSchema,
  ProblemSchema,
  SendChatMessageSchema,
} from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { idempotencyKey } from '../../platform/http/idempotency.js';
import type { AssistantLimits } from '../assistant/limits.js';
import type { ChatService } from './service.js';

const AUTHOR = { roles: ['AUTHOR'] as const };
const ADMIN = { roles: ['ADMIN'] as const };
const Params = z.object({ id: z.uuid() });
const errors = {
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  409: ProblemSchema,
  422: ProblemSchema,
  429: ProblemSchema,
};

/** Rate limits key on the signed-in user, after the auth guard has run. */
const perUser = (max: number, timeWindow: string) => ({
  max,
  timeWindow,
  hook: 'preHandler' as const,
  keyGenerator: (req: FastifyRequest) => `chat:${req.session?.userId ?? req.ip}`,
});

interface Deps {
  chat: ChatService;
  limits: AssistantLimits;
}

/** Reading and starting conversations. */
function registerSessionRoutes(app: RouteApp, { chat, limits }: Deps) {
  app.get(
    '/chat/sessions/current',
    {
      config: AUTHOR,
      schema: {
        tags: ['chat'],
        summary: "The author's latest conversation, or null",
        response: { 200: ChatSessionSchema.nullable(), ...errors },
      },
    },
    async (req) => chat.current(sessionOf(req)),
  );

  app.post(
    '/chat/sessions',
    {
      config: { ...AUTHOR, rateLimit: perUser(limits.chat.sessionsPerHour, '1 hour') },
      schema: {
        tags: ['chat'],
        summary: 'Start a new conversation',
        response: { 201: ChatSessionSchema, ...errors },
      },
    },
    async (req, reply) => reply.status(201).send(await chat.start(sessionOf(req))),
  );

  app.get(
    '/chat/sessions/:id',
    {
      config: AUTHOR,
      schema: {
        tags: ['chat'],
        summary: 'One of my conversations',
        params: Params,
        response: { 200: ChatSessionSchema, ...errors },
      },
    },
    async (req) => chat.get(sessionOf(req), req.params.id),
  );
}

/** Talking in a conversation and raising its ticket. */
function registerMessageRoutes(app: RouteApp, { chat, limits }: Deps) {
  app.post(
    '/chat/sessions/:id/messages',
    {
      config: { ...AUTHOR, rateLimit: perUser(limits.chat.messagesPerMinute, '1 minute') },
      schema: {
        tags: ['chat'],
        summary: 'Ask a question; the answer is grounded in my own records and fact-checked',
        params: Params,
        body: SendChatMessageSchema,
        response: { 200: ChatReplySchema, ...errors },
      },
    },
    async (req) => chat.send(sessionOf(req), req.params.id, req.body.body),
  );

  app.post(
    '/chat/sessions/:id/ticket',
    {
      config: AUTHOR,
      schema: {
        tags: ['chat'],
        summary:
          'Raise a ticket from this conversation (one per conversation; Idempotency-Key supported)',
        params: Params,
        body: ChatTicketRequestSchema,
        response: { 200: AuthorTicketSchema, 201: AuthorTicketSchema, ...errors },
      },
    },
    async (req, reply) => {
      const res = await chat.raiseTicket(
        sessionOf(req),
        req.params.id,
        req.body,
        idempotencyKey(req),
      );
      return reply.status(res.created ? 201 : 200).send(res.ticket);
    },
  );
}

/** Support staff read the transcript behind a chat ticket. */
function registerAdminRoutes(app: RouteApp, { chat }: Deps) {
  app.get(
    '/admin/chat/sessions/:id',
    {
      config: ADMIN,
      schema: {
        tags: ['chat'],
        summary: 'Transcript of a conversation that led to a ticket',
        params: Params,
        response: { 200: ChatTranscriptSchema, ...errors },
      },
    },
    async (req) => chat.transcript(req.params.id),
  );
}

export const chatRoutes: FastifyPluginAsyncZod<Deps> = async (app, deps) => {
  registerSessionRoutes(app, deps);
  registerMessageRoutes(app, deps);
  registerAdminRoutes(app, deps);
};
