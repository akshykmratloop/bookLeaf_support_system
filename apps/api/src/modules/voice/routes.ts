import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AdminVoiceCallSchema,
  AuthorTicketSchema,
  ChatTicketRequestSchema,
  ProblemSchema,
  StartVoiceCallSchema,
  VoiceCallSchema,
} from '@bookleaf/shared';
import { ForbiddenError } from '../../platform/errors.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { idempotencyKey } from '../../platform/http/idempotency.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import { bridgeCall } from './gateway.js';
import type { VoiceService } from './service.js';

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

interface Opts {
  voice: VoiceService;
  provider: VoiceProvider | null;
  appOrigin: string;
  now: () => Date;
}

export const voiceRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  const { voice } = opts;
  // Same normalisation as the CSRF guard, so a trailing slash in APP_ORIGIN cannot break calls.
  const allowedOrigin = new URL(opts.appOrigin).origin;

  app.post(
    '/voice/calls',
    {
      config: {
        ...AUTHOR,
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          hook: 'preHandler',
          keyGenerator: (req: FastifyRequest) => `voice:${req.session?.userId ?? req.ip}`,
        },
      },
      schema: {
        tags: ['voice'],
        summary:
          'Start a voice call (switch, provider, one-at-a-time and hourly/daily limits checked)',
        response: { 201: StartVoiceCallSchema, ...errors },
      },
    },
    async (req, reply) => reply.status(201).send(await voice.start(sessionOf(req))),
  );

  app.get(
    '/voice/calls/:id',
    {
      config: AUTHOR,
      schema: {
        tags: ['voice'],
        summary: 'One of my calls: status, transcript, ticket suggestion',
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
    async (req) => voice.adminGet(req.params.id),
  );

  app.get(
    '/voice/calls/:id/stream',
    {
      websocket: true,
      config: AUTHOR,
      schema: { hide: true, params: Params },
      // Browsers send cookies on cross-site WebSocket upgrades, so the Origin must be ours.
      preValidation: async (req) => {
        if (req.headers.origin !== allowedOrigin)
          throw new ForbiddenError('Calls must start from the BookLeaf portal');
      },
    },
    (socket, req) => {
      const provider = opts.provider;
      if (!provider) {
        socket.close(4503, 'voice unavailable');
        return;
      }
      void bridgeCall(socket, sessionOf(req), req.params.id, {
        voice,
        provider,
        log: req.log,
        now: opts.now,
      });
    },
  );
};
