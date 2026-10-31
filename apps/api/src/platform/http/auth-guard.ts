import type { WorkspaceRole } from '@bookleaf/shared';
import type { FastifyInstance, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import fp from 'fastify-plugin';
import { SESSION_COOKIE, type Session, type SessionCodec } from '../../modules/auth/session.js';
import { PLATFORM_COOKIE } from '../../modules/platform/session.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';
import { runAsWorkspace } from '../tenancy.js';
import './augment.js';

/** Owner-only (and similar) routes: the user's role in the session's workspace must be listed. */
async function requireWorkspaceRole(
  sessions: SessionCodec,
  session: Session,
  allowed: readonly WorkspaceRole[],
): Promise<void> {
  const role = await sessions.workspaceRole(session);
  if (!role || !allowed.includes(role))
    throw new ForbiddenError(`Only a workspace ${allowed.join(' or ').toLowerCase()} can do this.`);
}

/** The session a route needs, or null for public and unknown routes. */
async function sessionFor(req: FastifyRequest, sessions: SessionCodec): Promise<Session | null> {
  const config = req.routeOptions.config;
  // Unknown paths (which 404) need no session.
  if (req.routeOptions.url === undefined || config.public) return null;
  const token = req.cookies[SESSION_COOKIE];
  if (!token) {
    // A super admin's console session is no customer session (U-7).
    if (req.cookies[PLATFORM_COOKIE])
      throw new ForbiddenError('Super admins use the console at /platform, not customer screens.');
    throw new UnauthorizedError();
  }
  const session = await sessions.verify(token);
  if (config.roles && !config.roles.includes(session.role)) throw new ForbiddenError();
  if (config.workspaceRoles) await requireWorkspaceRole(sessions, session, config.workspaceRoles);
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
 * Two steps. `onRequest` checks the session before the body is read, so a caller who is not
 * signed in gets 401/403, never a validation error that describes the route's input. Then
 * `preHandler` runs the rest of the request (the handler and everything it starts) as the
 * session's workspace, so Postgres row-level security limits every query to it (S.8). The scope
 * is entered there, after body parsing, because parsing runs in the request stream's own async
 * context and would drop a scope entered earlier. `done` is called from inside the scope.
 */
export const authGuard = fp<{ sessions: SessionCodec }>(
  async (app: FastifyInstance, { sessions }) => {
    app.decorateRequest('session', null);
    app.addHook('onRequest', async (req) => {
      req.session = await sessionFor(req, sessions);
    });
    app.addHook('preHandler', (req, _reply, done: HookHandlerDoneFunction) => {
      continueAs(req, req.session, done);
    });
  },
);

/** For handlers: the guard guarantees a session on non-public routes. */
export function sessionOf(req: FastifyRequest): Session {
  if (!req.session) throw new UnauthorizedError();
  return req.session;
}
