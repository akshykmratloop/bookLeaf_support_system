import type { RouteApp } from '../../platform/http/route-app.js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AuthUserSchema,
  HostSignInRequestSchema,
  HostSignInResponseSchema,
  LoginRequestSchema,
  ProblemSchema,
  type AuthUser,
} from '@bookleaf/shared';
import '../../platform/http/augment.js';
import { sessionOf } from '../../platform/http/auth-guard.js';
import { perAddressAndEmail, perAddressAndWorkspace } from './address-limits.js';
import { DEVICE_COOKIES, deviceCookieOptions } from './device-token.js';
import type { LoginThrottle } from './login-throttle.js';
import { toAuthUser, type AuthService } from './service.js';
import { SESSION_COOKIE } from './session.js';

interface Opts {
  auth: AuthService;
  /**
   * Exchanges a host hand-over token for a session (authors arriving from the product). With a
   * workspace slug (the widget page's), a token for another workspace is refused.
   */
  signInFromHost: (
    token: string,
    workspace?: string,
  ) => Promise<{ user: AuthUser; token: string; workspaceSlug: string }>;
  /** Where authors sign in on the host product; the login page links there. */
  hostSignInUrl: string | null;
  ttlSeconds: number;
  /** Sessions started by a host hand-over are shorter (HOST_SESSION_TTL_HOURS). */
  hostTtlSeconds: number;
  secureCookies: boolean;
  /** Embed mode: the cookie must also work inside the host's iframe. */
  embedded: boolean;
  /** Limits failed sign-ins per browser and per account (device cookies). */
  throttle: LoginThrottle;
}

/** Loose per-address backstops, keyed with the email or workspace too (see address-limits.ts). */
const HOST_LIMIT = perAddressAndWorkspace('host-sign-in', 60, '1 minute');
const LOGIN_LIMIT = perAddressAndEmail('staff-login', 20, '1 minute');

/**
 * The session cookie. In embed mode it is a partitioned third-party cookie (SameSite=None;
 * Secure; Partitioned), so it works in the host's iframe but is never shared across sites.
 * Cross-site writes are still blocked by the Origin check (csrf.ts).
 */
const cookieFor = ({ secureCookies, embedded }: Pick<Opts, 'secureCookies' | 'embedded'>) =>
  embedded
    ? { httpOnly: true, sameSite: 'none' as const, secure: true, partitioned: true, path: '/' }
    : { httpOnly: true, sameSite: 'lax' as const, secure: secureCookies, path: '/' };

/** Signing in: the session lives in an httpOnly cookie; the browser is remembered (device). */
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
      const attempt = {
        area: 'staff' as const,
        email: req.body.email,
        deviceToken: req.cookies[DEVICE_COOKIES.staff],
      };
      const { result, deviceToken } = await opts.throttle.guard(attempt, () =>
        auth.login(req.body),
      );
      reply.setCookie(SESSION_COOKIE, result.token, { ...cookie, maxAge: ttlSeconds });
      reply.setCookie(DEVICE_COOKIES.staff, deviceToken, deviceCookieOptions(opts.secureCookies));
      return { user: result.user };
    },
  );
}

/** Signing out ends every session of the user; the device cookie stays (it is no session). */
function registerSignOut(app: RouteApp, opts: Opts) {
  const { auth } = opts;
  const cookie = cookieFor(opts);
  app.post(
    '/auth/logout',
    {
      config: { public: true },
      schema: {
        tags: ['auth'],
        summary: 'Sign out (ends every session of this user, on all devices)',
        response: { 204: z.null() },
      },
    },
    async (req, reply) => {
      const token = req.cookies[SESSION_COOKIE];
      if (token) await auth.logout(token);
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
          200: HostSignInResponseSchema,
          401: ProblemSchema,
          403: ProblemSchema,
          409: ProblemSchema,
          503: ProblemSchema,
        },
      },
    },
    async (req, reply) => {
      const { user, token, workspaceSlug } = await opts.signInFromHost(
        req.body.token,
        req.body.workspace,
      );
      reply.setCookie(SESSION_COOKIE, token, { ...cookie, maxAge: opts.hostTtlSeconds });
      return { user, workspace: { slug: workspaceSlug } };
    },
  );
}

/** How authors sign in: the login page links to the host product. */
function registerSignInOptions(app: RouteApp, opts: Opts) {
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
  registerSignOut(app, opts);
  registerHostSignIn(app, opts);
  registerSignInOptions(app, opts);
  registerMe(app);
};
