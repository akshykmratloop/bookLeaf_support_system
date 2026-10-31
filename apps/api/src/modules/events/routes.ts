import type { ServerResponse } from 'node:http';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { UnauthorizedError, WorkspaceSuspendedError } from '../../platform/errors.js';
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

/** The part of a response the stream writes to. */
export type Stream = Pick<ServerResponse, 'write' | 'end'>;

function openStream(res: ServerResponse): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write('retry: 3000\n\n');
}

/** The sign-in really is over: signed out, expired, or the workspace is suspended. */
const endsSession = (err: unknown) =>
  err instanceof UnauthorizedError || err instanceof WorkspaceSuspendedError;

/**
 * One heartbeat: re-checks the session, so a stream never outlives its sign-in. Only a session
 * that is really over ends the stream; when the check itself fails (the database is briefly
 * unreachable) this ping is skipped and the next one tries again.
 */
export async function heartbeat(
  res: Stream,
  check: () => Promise<unknown>,
  stop: () => void,
  log: Pick<FastifyBaseLogger, 'warn'>,
): Promise<void> {
  try {
    await check();
  } catch (err) {
    if (!endsSession(err)) {
      log.warn({ err }, 'live updates: session check failed, skipping this heartbeat');
      return;
    }
    res.write('event: session-expired\ndata: {}\n\n');
    stop();
    res.end();
    return;
  }
  res.write(': ping\n\n');
}

/**
 * Server-Sent Events. Each event is only a hint ({ type, ticketId }); the client refetches through
 * the REST API, so every read is permission-checked again and a missed event loses nothing.
 * Open streams are ended when the server shuts down, so closing never waits on them.
 */
export const eventRoutes: FastifyPluginAsync<Opts> = async (app, { events, sessions }) => {
  const open = new Set<ServerResponse>();
  // preClose: before the server waits for in-flight requests, which a live stream never finishes.
  app.addHook('preClose', async () => {
    for (const res of open) res.end();
    open.clear();
  });

  app.get(
    '/events',
    { schema: { tags: ['events'], summary: 'Live ticket updates (text/event-stream)' } },
    (req, reply) => {
      const session = sessionOf(req);
      const token = req.cookies[SESSION_COOKIE] ?? '';
      reply.hijack();
      const res = reply.raw;
      openStream(res);
      open.add(res);
      const unsubscribe = events.subscribe((e) => {
        if (!canSee(session, e)) return;
        res.write(
          `event: ticket\ndata: ${JSON.stringify({ type: e.type, ticketId: e.ticketId })}\n\n`,
        );
      });
      const close = () => {
        clearInterval(timer);
        unsubscribe();
        open.delete(res);
      };
      const timer = setInterval(
        () => void heartbeat(res, () => sessions.verify(token), close, req.log),
        HEARTBEAT_MS,
      );
      req.raw.on('close', close);
    },
  );
};
