import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { findByEmail, type AuthorAccount } from '../data/authors.js';
import { sameSecret } from '../secrets.js';
import { SESSION_COOKIE, signedInAccount as accountOf } from '../session.js';
import { mintSupportToken, signHostSession } from '../tokens.js';
import type { RouteApp } from './route-app.js';

const LoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

interface Options {
  authors: AuthorAccount[];
  password: string;
  signingSecret: string;
  /** Mark the session cookie Secure (HTTPS only). */
  secureCookies: boolean;
}

const signedInAccount = (req: Parameters<typeof accountOf>[0], o: Options) =>
  accountOf(req, o.authors, o.signingSecret);

/** Password guesses: 10 a minute per address and email (checked after the body is read). */
export const LOGINS_PER_MINUTE = 10;
/** Opening support mints a token; 30 a minute per session (or address, when signed out). */
export const SUPPORT_TOKENS_PER_MINUTE = 30;

const emailOf = (req: FastifyRequest) => {
  const parsed = LoginSchema.shape.email.safeParse((req.body as { email?: unknown } | null)?.email);
  return parsed.success ? parsed.data.toLowerCase() : '';
};

const perLogin = {
  max: LOGINS_PER_MINUTE,
  timeWindow: '1 minute',
  hook: 'preHandler' as const,
  keyGenerator: (req: FastifyRequest) => `login:${req.ip}:${emailOf(req)}`,
};

const perSession = {
  max: SUPPORT_TOKENS_PER_MINUTE,
  timeWindow: '1 minute',
  keyGenerator: (req: FastifyRequest) =>
    `support-token:${req.cookies[SESSION_COOKIE] ?? `ip:${req.ip}`}`,
};

function registerLogin(app: RouteApp, o: Options) {
  const config = { rateLimit: perLogin };
  app.post('/login', { config, schema: { body: LoginSchema } }, async (req, reply) => {
    const account = findByEmail(o.authors, req.body.email);
    if (!account || !sameSecret(req.body.password, o.password))
      return reply.status(401).send({ error: 'Wrong email or password' });
    const session = await signHostSession(account.record.externalId, o.signingSecret);
    reply.setCookie(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: 'strict',
      secure: o.secureCookies,
      path: '/',
    });
    return { name: account.record.name };
  });
  app.post('/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}

function registerSupportToken(app: RouteApp, o: Options) {
  app.get('/me', async (req, reply) => {
    const account = await signedInAccount(req, o);
    if (!account) return reply.status(401).send({ error: 'Not signed in' });
    return { name: account.record.name, email: account.email };
  });
  // A fresh token each time support is opened: tokens live five minutes at most.
  app.post('/support-token', { config: { rateLimit: perSession } }, async (req, reply) => {
    const account = await signedInAccount(req, o);
    if (!account) return reply.status(401).send({ error: 'Not signed in' });
    return { token: await mintSupportToken(account, o.signingSecret) };
  });
}

/** The demo product's own sign-in, and the hand-over to the support module. */
export const accountRoutes: FastifyPluginAsyncZod<Options> = async (app, opts) => {
  registerLogin(app, opts);
  registerSupportToken(app, opts);
};
