import type { FastifyInstance, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import fp from 'fastify-plugin';
import { SESSION_COOKIE, type Session, type SessionCodec } from '../../modules/auth/session.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';
import { runAsWorkspace } from '../tenancy.js';
import './augment.js';

/** The session a route needs, or null for public and unknown routes. */
async function sessionFor(req: FastifyRequest, sessions: SessionCodec): Promise<Session | null> {
  const config = req.routeOptions.config;
  // Unknown paths (which 404) need no session.
  if (req.routeOptions.url === undefined || config.public) return null;
  const token = req.cookies[SESSION_COOKIE];
  if (!token) throw new UnauthorizedError();
  const session = await sessions.verify(token);
  if (config.roles && !config.roles.includes(session.role)) throw new ForbiddenError();
  return session;
}

/** Runs the rest of the request (`done`) in the session's workspace, or unscoped when public. */
function continueAs(req: FastifyRequest, session: Session | null, done: HookHandlerDoneFunction) {
  if (!session) return done();
  req.session = session;
  runAsWorkspace(session.workspaceId, () => done());
}

/**
 * Default deny: every route in the scope this is registered in needs a valid session unless it
 * is marked public. It is registered inside the /api/v1 scope, so it covers exactly the API
 * wherever the module is mounted, without looking at the URL.
 *
 * The rest of a signed-in request (the handler and everything it starts) then runs as the
 * session's workspace, so Postgres row-level security limits every query to it (S.8). That is
 * why this hook uses `done`: the handler is called from inside `runAsWorkspace`.
 */
export const authGuard = fp<{ sessions: SessionCodec }>(
  async (app: FastifyInstance, { sessions }) => {
    app.decorateRequest('session', null);
    app.addHook('preHandler', (req, _reply, done: HookHandlerDoneFunction) => {
      sessionFor(req, sessions)
        .then((session) => continueAs(req, session, done))
        .catch(done as (err: Error) => void);
    });
  },
);

/** For handlers: the guard guarantees a session on non-public routes. */
export function sessionOf(req: FastifyRequest): Session {
  if (!req.session) throw new UnauthorizedError();
  return req.session;
}
