import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { LoginRequestSchema, PlatformAdminSchema, ProblemSchema } from '@bookleaf/shared';
import '../../platform/http/augment.js';
import type { PlatformAuth } from './auth.js';
import { toPlatformAdmin } from './auth.js';
import { platformAdminOf } from './guard.js';
import type { LoginThrottle } from '../auth/login-throttle.js';
import { PLATFORM_COOKIE } from './session.js';

interface Opts {
  auth: PlatformAuth;
  ttlSeconds: number;
  secureCookies: boolean;
  /** Counts sign-in attempts per account (10 per 15 minutes, from all addresses). */
  throttle: LoginThrottle;
}

/** A loose per-address backstop; guessing is limited per account by `throttle`. */
const LOGIN_LIMIT = { max: 20, timeWindow: '1 minute' };

const tags = ['platform'];

/**
 * The console's own cookie: first-party only (never inside a customer's iframe), httpOnly and
 * SameSite=Strict. Path "/" on purpose: the customer guard must see it to answer 403, not 401.
 */
const cookieFor = (secure: boolean) =>
  ({ httpOnly: true, sameSite: 'strict', secure, path: '/' }) as const;

type App = Parameters<FastifyPluginAsyncZod<Opts>>[0];
type Cookie = ReturnType<typeof cookieFor>;

function loginRoute(app: App, opts: Opts, cookie: Cookie): void {
  app.post(
    '/auth/login',
    {
      config: { public: true, rateLimit: LOGIN_LIMIT },
      schema: {
        tags,
        summary: 'Super admin sign-in with email and password',
        body: LoginRequestSchema,
        response: { 200: z.object({ admin: PlatformAdminSchema }), 401: ProblemSchema },
      },
    },
    async (req, reply) => {
      await opts.throttle('platform', req.body.email);
      const { admin, token } = await opts.auth.login(req.body);
      reply.setCookie(PLATFORM_COOKIE, token, { ...cookie, maxAge: opts.ttlSeconds });
      return { admin };
    },
  );
}

function logoutRoute(app: App, opts: Opts, cookie: Cookie): void {
  app.post(
    '/auth/logout',
    {
      config: { public: true },
      schema: {
        tags,
        summary: 'Sign out of the console on every device',
        response: { 204: z.null() },
      },
    },
    async (req, reply) => {
      const token = req.cookies[PLATFORM_COOKIE];
      if (token) await opts.auth.logout(token);
      reply.clearCookie(PLATFORM_COOKIE, cookie);
      return reply.status(204).send(null);
    },
  );
}

/** Super admin sign-in, sign-out and "who am I" (U-7). */
export const platformAuthRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  const cookie = cookieFor(opts.secureCookies);
  loginRoute(app, opts, cookie);
  logoutRoute(app, opts, cookie);
  app.get(
    '/auth/me',
    {
      schema: {
        tags,
        summary: 'The signed-in super admin',
        response: {
          200: z.object({ admin: PlatformAdminSchema }),
          401: ProblemSchema,
          403: ProblemSchema,
        },
      },
    },
    async (req) => ({ admin: toPlatformAdmin(platformAdminOf(req)) }),
  );
};
