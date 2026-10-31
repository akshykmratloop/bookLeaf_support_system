import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { VOICE_SOCKET_PROTOCOL, VOICE_TICKET_PROTOCOL_PREFIX } from '@bookleaf/shared';
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
const Ticket = z.string().min(1).max(4096);
const MAX_PROTOCOLS = 8;

/** The subprotocols the browser offered (`Sec-WebSocket-Protocol: bookleaf.v1, ticket.<jwt>`). */
export function offeredProtocols(header: string | string[] | undefined): string[] {
  const raw = Array.isArray(header) ? header.join(',') : (header ?? '');
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_PROTOCOLS);
}

/** The one-time ticket offered as a subprotocol, if any. */
export function ticketFrom(header: string | string[] | undefined): string | null {
  const offered = offeredProtocols(header).find((p) => p.startsWith(VOICE_TICKET_PROTOCOL_PREFIX));
  if (!offered) return null;
  const parsed = Ticket.safeParse(offered.slice(VOICE_TICKET_PROTOCOL_PREFIX.length));
  if (!parsed.success) throw new UnauthorizedError();
  return parsed.data;
}

/**
 * The server's answer to the offered subprotocols: always `bookleaf.v1`, never the ticket (the
 * ticket is not echoed back). Refused (no subprotocol) when the client did not offer it.
 */
export const chooseProtocol = (offered: Set<string>): string | false =>
  offered.has(VOICE_SOCKET_PROTOCOL) ? VOICE_SOCKET_PROTOCOL : false;

/**
 * The caller: from a one-time ticket when given (cross-site web app), else the session cookie.
 * The ticket travels as a subprotocol, so it never appears in a URL or an access log.
 */
async function callerOf(req: FastifyRequest, opts: StreamOpts): Promise<Session> {
  const { id } = Params.parse(req.params);
  const ticket = ticketFrom(req.headers['sec-websocket-protocol']);
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
      schema: { hide: true, params: Params },
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
