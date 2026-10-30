import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ForbiddenError, UnauthorizedError } from '../../platform/errors.js';
import { withWorkspace } from '../../platform/tenancy.js';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import { SESSION_COOKIE, type Session, type SessionCodec } from '../auth/session.js';
import { bridgeCall } from './gateway.js';
import type { VoiceService } from './service.js';
import type { StreamTickets } from './stream-ticket.js';

export interface StreamOpts {
  voice: VoiceService;
  voiceFor: (workspaceId: string) => Promise<VoiceProvider | null>;
  appOrigin: string;
  now: () => Date;
  sessions: SessionCodec;
  tickets: StreamTickets;
}

const Params = z.object({ id: z.uuid() });
const Query = z.object({ ticket: z.string().min(1).max(4096).optional() });

/** The caller: from a one-time ticket when given (cross-site web app), else the session cookie. */
async function callerOf(req: FastifyRequest, opts: StreamOpts): Promise<Session> {
  const { id } = Params.parse(req.params);
  const { ticket } = Query.parse(req.query);
  if (ticket) return opts.tickets.redeem(ticket, id);
  const cookie = req.cookies[SESSION_COOKIE];
  if (!cookie) throw new UnauthorizedError();
  return opts.sessions.verify(cookie);
}

/** The live call: browser audio bridged to the speech provider. */
export function registerStreamRoute(app: RouteApp, opts: StreamOpts) {
  // Same normalisation as the CSRF guard, so a trailing slash in APP_ORIGIN cannot break calls.
  const allowedOrigin = new URL(opts.appOrigin).origin;

  app.get(
    '/voice/calls/:id/stream',
    {
      websocket: true,
      // The guard's cookie check is replaced by callerOf below (ticket or cookie).
      config: { public: true },
      schema: { hide: true, params: Params, querystring: Query },
      // Browsers send cookies on cross-site WebSocket upgrades, so the Origin must be ours.
      preValidation: async (req) => {
        if (req.headers.origin !== allowedOrigin)
          throw new ForbiddenError('Calls must start from the BookLeaf portal');
      },
      preHandler: async (req) => {
        req.session = await callerOf(req, opts);
        if (req.session.role !== 'AUTHOR') throw new ForbiddenError();
      },
    },
    // The upgrade may run outside the request's scope: set the caller's workspace again (S.8).
    async (socket, req) => {
      const session = req.session as Session;
      await withWorkspace(session.workspaceId, async () => {
        const provider = await opts.voiceFor(session.workspaceId);
        if (!provider) {
          socket.close(4503, 'voice unavailable');
          return;
        }
        void bridgeCall(socket, session, req.params.id, {
          voice: opts.voice,
          provider,
          log: req.log,
          now: opts.now,
        });
      });
    },
  );
}
