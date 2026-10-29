import type { FastifyRequest } from 'fastify';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AdminVoiceCallSchema,
  AuthorTicketSchema,
  ChatTicketRequestSchema,
  ProblemSchema,
  StartVoiceCallRequestSchema,
  StartVoiceCallSchema,
  VoiceCallSchema,
} from '@bookleaf/shared';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { idempotencyKey } from '../../platform/http/idempotency.js';
import { registerStreamRoute, type StreamOpts } from './stream-route.js';

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
  503: ProblemSchema,
};

interface Opts extends StreamOpts {
  /** Public wss:// origin of this API when the web app is on another site (PUBLIC_API_WS_ORIGIN). */
  publicWsOrigin: string | null;
}

/** Starting a call is limited per signed-in user, after the auth guard has run. */
const START_LIMIT = {
  max: 10,
  timeWindow: '1 minute',
  hook: 'preHandler' as const,
  keyGenerator: (req: FastifyRequest) => `voice:${req.session?.userId ?? req.ip}`,
};

/** Starting a call, or continuing the last one. */
function registerStartRoutes(app: RouteApp, { voice, tickets, publicWsOrigin }: Opts) {
  app.post(
    '/voice/calls',
    {
      config: { ...AUTHOR, rateLimit: START_LIMIT },
      schema: {
        tags: ['voice'],
        summary:
          'Start a voice call: inside a chat with {chatSessionId}, or continue the last one with {resume: true} (limits checked)',
        body: StartVoiceCallRequestSchema.nullish(),
        response: { 201: StartVoiceCallSchema, ...errors },
      },
    },
    async (req, reply) => {
      const session = sessionOf(req);
      const started = await voice.start(session, {
        resume: req.body?.resume ?? false,
        chatSessionId: req.body?.chatSessionId,
      });
      if (!publicWsOrigin) return reply.status(201).send(started);
      const ticket = await tickets.issue(session, started.id);
      const socketUrl = `${publicWsOrigin}${started.socketPath}?ticket=${encodeURIComponent(ticket)}`;
      return reply.status(201).send({ ...started, socketUrl });
    },
  );

  app.get(
    '/voice/calls/resumable',
    {
      config: AUTHOR,
      schema: {
        tags: ['voice'],
        summary: 'My last call if it can be continued (ended under an hour ago, ticket not sent)',
        response: { 200: VoiceCallSchema.nullable(), ...errors },
      },
    },
    async (req) => voice.resumable(sessionOf(req)),
  );
}

/** Reading one of my calls and raising its ticket. */
function registerCallRoutes(app: RouteApp, { voice }: Opts) {
  app.get(
    '/voice/calls/:id',
    {
      config: AUTHOR,
      schema: {
        tags: ['voice'],
        summary: 'One of my calls: status, transcript and its ticket draft',
        params: Params,
        response: { 200: VoiceCallSchema, ...errors },
      },
    },
    async (req) => voice.get(sessionOf(req), req.params.id),
  );

  app.post(
    '/voice/calls/:id/ticket',
    {
      config: AUTHOR,
      schema: {
        tags: ['voice'],
        summary: 'Raise a ticket from an ended call (one per call; Idempotency-Key supported)',
        params: Params,
        body: ChatTicketRequestSchema,
        response: { 200: AuthorTicketSchema, 201: AuthorTicketSchema, ...errors },
      },
    },
    async (req, reply) => {
      const res = await voice.raiseTicket(
        sessionOf(req),
        req.params.id,
        req.body,
        idempotencyKey(req),
      );
      return reply.status(res.created ? 201 : 200).send(res.ticket);
    },
  );
}

/** Support staff read the call behind a ticket. */
function registerAdminRoutes(app: RouteApp, { voice }: Opts) {
  app.get(
    '/admin/voice/calls/:id',
    {
      config: ADMIN,
      schema: {
        tags: ['voice'],
        summary: 'A call linked to a ticket, with the check of figures the assistant spoke',
        params: Params,
        response: { 200: AdminVoiceCallSchema, ...errors },
      },
    },
    async (req) => voice.adminGet(sessionOf(req), req.params.id),
  );
}

export const voiceRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerStartRoutes(app, opts);
  registerCallRoutes(app, opts);
  registerAdminRoutes(app, opts);
  registerStreamRoute(app, opts);
};
