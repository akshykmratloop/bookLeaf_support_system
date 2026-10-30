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

/** Calls `done` inside the platform scope so the handler inherits it. */
const enterPlatform = (_req: FastifyRequest, _reply: unknown, done: HookHandlerDoneFunction) =>
  runAsPlatform(() => done());

/**
 * Default deny for the /api/v1/platform scope (U-7): every route needs a super admin session
 * unless it is public (sign-in). The session is checked in `onRequest`, before the body is read,
 * so a caller without one never gets a validation error. The rest of the request then runs on
 * the owner connection, the only one that may read platform tables; that scope is entered after
 * body parsing (see auth-guard.ts for why).
 */
export const platformGuard = fp<{ sessions: PlatformSessions }>(
  async (app: FastifyInstance, { sessions }) => {
    app.decorateRequest('platformAdmin', null);
    app.addHook('onRequest', async (req) => {
      req.platformAdmin = await platformSessionFor(req, sessions);
    });
    app.addHook('preHandler', enterPlatform);
  },
);

/** For handlers: the guard guarantees a console session on non-public routes. */
export function platformAdminOf(req: FastifyRequest): PlatformSession {
  if (!req.platformAdmin) throw new UnauthorizedError();
  return req.platformAdmin;
}
