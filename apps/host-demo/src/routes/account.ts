import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { findByEmail, findById, type AuthorAccount } from '../data/authors.js';
import { sameSecret } from '../secrets.js';
import { mintSupportToken, readHostSession, signHostSession } from '../tokens.js';
import type { RouteApp } from './route-app.js';

const COOKIE = 'hd_session';
const LoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

interface Options {
  authors: AuthorAccount[];
  password: string;
  signingSecret: string;
}

async function signedInAccount(req: FastifyRequest, o: Options) {
  const token = req.cookies[COOKIE];
  const id = token ? await readHostSession(token, o.signingSecret) : null;
  return id ? findById(o.authors, id) : null;
}

function registerLogin(app: RouteApp, o: Options) {
  app.post('/login', { schema: { body: LoginSchema } }, async (req, reply) => {
    const account = findByEmail(o.authors, req.body.email);
    if (!account || !sameSecret(req.body.password, o.password))
      return reply.status(401).send({ error: 'Wrong email or password' });
    const session = await signHostSession(account.record.externalId, o.signingSecret);
    reply.setCookie(COOKIE, session, { httpOnly: true, sameSite: 'strict', path: '/' });
    return { name: account.record.name };
  });
  app.post('/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE, { path: '/' });
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
  app.post('/support-token', async (req, reply) => {
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
