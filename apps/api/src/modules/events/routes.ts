import type { FastifyPluginAsync } from 'fastify';
import type { EventBus, TicketEvent } from '../../platform/event-bus.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { SESSION_COOKIE, type Session, type SessionCodec } from '../auth/session.js';

const HEARTBEAT_MS = 25_000;

/** Authors receive only author-visible events for their own tickets; admins receive everything. */
export function canSee(session: Session, e: TicketEvent): boolean {
  return session.role === 'ADMIN' || (e.authorVisible && e.authorId === session.authorId);
}

/**
 * Server-Sent Events. Each event is only a hint ({ type, ticketId }); the client refetches through
 * the REST API, so every read is permission-checked again and a missed event loses nothing.
 */
export const eventRoutes: FastifyPluginAsync<{ events: EventBus; sessions: SessionCodec }> = async (app, { events, sessions }) => {
  app.get('/events', { schema: { tags: ['events'], summary: 'Live ticket updates (text/event-stream)' } }, (req, reply) => {
    const session = sessionOf(req);
    const token = req.cookies[SESSION_COOKIE] ?? '';
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 3000\n\n');
    const unsubscribe = events.subscribe((e) => {
      if (canSee(session, e)) res.write(`event: ticket\ndata: ${JSON.stringify({ type: e.type, ticketId: e.ticketId })}\n\n`);
    });
    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    const heartbeat = setInterval(() => {
      sessions.verify(token).then(
        () => res.write(': ping\n\n'),
        () => {
          res.write('event: session-expired\ndata: {}\n\n');
          close();
          res.end();
        },
      );
    }, HEARTBEAT_MS);
    req.raw.on('close', close);
  });
};
