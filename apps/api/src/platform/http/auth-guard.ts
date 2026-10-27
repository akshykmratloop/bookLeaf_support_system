import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { SESSION_COOKIE, type Session, type SessionCodec } from '../../modules/auth/session.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';
import './augment.js';

/** Default deny: every /api route needs a valid session unless it is marked public. */
export const authGuard = fp<{ sessions: SessionCodec }>(
  async (app: FastifyInstance, { sessions }) => {
    app.decorateRequest('session', null);
    app.addHook('preHandler', async (req) => {
      const config = req.routeOptions.config;
      const isApiRoute = req.url.startsWith('/api/v1/') && req.routeOptions.url !== undefined;
      // Docs, health, static files and unknown paths (which 404) need no session.
      if (!isApiRoute || config.public) return;
      const token = req.cookies[SESSION_COOKIE];
      if (!token) throw new UnauthorizedError();
      req.session = await sessions.verify(token);
      if (config.roles && !config.roles.includes(req.session.role)) throw new ForbiddenError();
    });
  },
);

/** For handlers: the guard guarantees a session on non-public routes. */
export function sessionOf(req: FastifyRequest): Session {
  if (!req.session) throw new UnauthorizedError();
  return req.session;
}
