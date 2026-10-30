import type { FastifyInstance, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import fp from 'fastify-plugin';
import { ForbiddenError, UnauthorizedError } from '../../platform/errors.js';
import { runAsPlatform } from '../../platform/tenancy.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { PLATFORM_COOKIE, type PlatformSession, type PlatformSessions } from './session.js';
import '../../platform/http/augment.js';

const CUSTOMERS_ONLY = () =>
  new ForbiddenError('This is the support provider’s console. Sign in at /platform/login.');

/** The console session a route needs: none for public routes; 403 for a customer session. */
async function platformSessionFor(
  req: FastifyRequest,
  sessions: PlatformSessions,
): Promise<PlatformSession | null> {
  if (req.routeOptions.url === undefined || req.routeOptions.config.public) return null;
  const token = req.cookies[PLATFORM_COOKIE];
  if (!token) {
    if (req.cookies[SESSION_COOKIE]) throw CUSTOMERS_ONLY();
    throw new UnauthorizedError();
  }
  return sessions.verify(token);
}

/** Checks the session, then calls `done` inside the platform scope so the handler inherits it. */
function guardHook(sessions: PlatformSessions) {
  return (req: FastifyRequest, _reply: unknown, done: HookHandlerDoneFunction) => {
    const enter = (admin: PlatformSession | null) => {
      req.platformAdmin = admin;
      runAsPlatform(() => done());
    };
    platformSessionFor(req, sessions)
      .then(enter)
      .catch(done as (err: Error) => void);
  };
}

/**
 * Default deny for the /api/v1/platform scope (U-7): every route needs a super admin session
 * unless it is public (sign-in). The rest of the request runs on the owner connection, the only
 * one that may read platform tables.
 */
export const platformGuard = fp<{ sessions: PlatformSessions }>(
  async (app: FastifyInstance, { sessions }) => {
    app.decorateRequest('platformAdmin', null);
    app.addHook('preHandler', guardHook(sessions));
  },
);

/** For handlers: the guard guarantees a console session on non-public routes. */
export function platformAdminOf(req: FastifyRequest): PlatformSession {
  if (!req.platformAdmin) throw new UnauthorizedError();
  return req.platformAdmin;
}
