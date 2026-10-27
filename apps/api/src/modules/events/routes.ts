import type { ServerResponse } from 'node:http';
import type { FastifyPluginAsync } from 'fastify';
import type { EventBus, TicketEvent } from '../../platform/event-bus.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { SESSION_COOKIE, type Session, type SessionCodec } from '../auth/session.js';

const HEARTBEAT_MS = 25_000;

/**
 * Only the ticket's own workspace hears about it. There, admins receive everything and authors
 * only author-visible events for their own tickets.
 */
export function canSee(session: Session, e: TicketEvent): boolean {
  if (e.workspaceId !== session.workspaceId) return false;
  return session.role === 'ADMIN' || (e.authorVisible && e.authorId === session.authorId);
}

interface Opts {
  events: EventBus;
  sessions: SessionCodec;
}

type Stream = ServerResponse;

function openStream(res: Stream): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write('retry: 3000\n\n');
}

/** Every heartbeat re-checks the session, so a stream never outlives its sign-in. */
function keepAlive(res: Stream, check: () => Promise<unknown>, stop: () => void) {
  return setInterval(() => {
    check().then(
      () => res.write(': ping\n\n'),
      () => {
        res.write('event: session-expired\ndata: {}\n\n');
        stop();
        res.end();
      },
    );
  }, HEARTBEAT_MS);
}

/**
 * Server-Sent Events. Each event is only a hint ({ type, ticketId }); the client refetches through
 * the REST API, so every read is permission-checked again and a missed event loses nothing.
 */
export const eventRoutes: FastifyPluginAsync<Opts> = async (app, { events, sessions }) => {
  app.get(
    '/events',
    { schema: { tags: ['events'], summary: 'Live ticket updates (text/event-stream)' } },
    (req, reply) => {
      const session = sessionOf(req);
      const token = req.cookies[SESSION_COOKIE] ?? '';
      reply.hijack();
      const res = reply.raw;
      openStream(res);
      const unsubscribe = events.subscribe((e) => {
        if (!canSee(session, e)) return;
        res.write(
          `event: ticket\ndata: ${JSON.stringify({ type: e.type, ticketId: e.ticketId })}\n\n`,
        );
      });
      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      const heartbeat = keepAlive(res, () => sessions.verify(token), close);
      req.raw.on('close', close);
    },
  );
};
