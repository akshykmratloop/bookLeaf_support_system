import type { FastifyRequest } from 'fastify';
import type { RouteApp } from '../../platform/http/route-app.js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AuthUserSchema,
  HostSignInRequestSchema,
  LoginRequestSchema,
  ProblemSchema,
  type AuthUser,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { toAuthUser, type AuthService } from './service.js';
import { SESSION_COOKIE } from './session.js';

interface Opts {
  auth: AuthService;
  /** Exchanges a host hand-over token for a session (authors arriving from the product). */
  signInFromHost: (token: string) => Promise<{ user: AuthUser; token: string }>;
  /** Where authors sign in on the host product; the login page links there. */
  hostSignInUrl: string | null;
  ttlSeconds: number;
  secureCookies: boolean;
  /** Embed mode: the cookie must also work inside the host's iframe. */
  embedded: boolean;
}

const HOST_LIMIT = { max: 20, timeWindow: '1 minute' };

/** Five sign-in tries a minute for each address and email. */
const LOGIN_LIMIT = {
  max: 5,
  timeWindow: '1 minute',
  keyGenerator: (req: FastifyRequest) =>
    `${req.ip}:${String((req.body as { email?: unknown } | undefined)?.email ?? '').toLowerCase()}`,
};

/**
 * The session cookie. In embed mode it is a partitioned third-party cookie (SameSite=None;
 * Secure; Partitioned), so it works in the host's iframe but is never shared across sites.
 * Cross-site writes are still blocked by the Origin check (csrf.ts).
 */
const cookieFor = ({ secureCookies, embedded }: Pick<Opts, 'secureCookies' | 'embedded'>) =>
  embedded
    ? { httpOnly: true, sameSite: 'none' as const, secure: true, partitioned: true, path: '/' }
    : { httpOnly: true, sameSite: 'lax' as const, secure: secureCookies, path: '/' };

/** Signing in and out: the session lives in an httpOnly cookie. */
function registerSignIn(app: RouteApp, opts: Opts) {
  const { auth, ttlSeconds } = opts;
  const cookie = cookieFor(opts);

  app.post(
    '/auth/login',
    {
      config: { public: true, rateLimit: LOGIN_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Sign in with email and password',
        body: LoginRequestSchema,
        response: { 200: z.object({ user: AuthUserSchema }), 401: ProblemSchema },
      },
    },
    async (req, reply) => {
      const { user, token } = await auth.login(req.body);
      reply.setCookie(SESSION_COOKIE, token, { ...cookie, maxAge: ttlSeconds });
      return { user };
    },
  );

  app.post(
    '/auth/logout',
    {
      config: { public: true },
      schema: { tags: ['auth'], summary: 'Sign out', response: { 204: z.null() } },
    },
    async (_req, reply) => {
      reply.clearCookie(SESSION_COOKIE, cookie);
      return reply.status(204).send(null);
    },
  );
}

/** Who is signed in. */
function registerMe(app: RouteApp) {
  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'The signed-in user',
        response: { 200: z.object({ user: AuthUserSchema }), 401: ProblemSchema },
      },
    },
    async (req) => ({ user: toAuthUser(sessionOf(req)) }),
  );
}

/** Authors sign in on the host product, which hands them over with a short token. */
function registerHostSignIn(app: RouteApp, opts: Opts) {
  const cookie = cookieFor(opts);
  app.post(
    '/auth/host',
    {
      config: { public: true, rateLimit: HOST_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Sign in with a hand-over token from the host product',
        body: HostSignInRequestSchema,
        response: {
          200: z.object({ user: AuthUserSchema }),
          401: ProblemSchema,
          409: ProblemSchema,
          503: ProblemSchema,
        },
      },
    },
    async (req, reply) => {
      const { user, token } = await opts.signInFromHost(req.body.token);
      reply.setCookie(SESSION_COOKIE, token, { ...cookie, maxAge: opts.ttlSeconds });
      return { user };
    },
  );
  app.get(
    '/auth/options',
    {
      config: { public: true },
      schema: {
        tags: ['auth'],
        summary: 'How to sign in: where authors go to sign in on the host product',
        response: { 200: z.object({ hostSignInUrl: z.string().nullable() }) },
      },
    },
    async () => ({ hostSignInUrl: opts.hostSignInUrl }),
  );
}

export const authRoutes: FastifyPluginAsyncZod<Opts> = async (app, opts) => {
  registerSignIn(app, opts);
  registerHostSignIn(app, opts);
  registerMe(app);
};
