import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { HostConfig } from './config.js';
import { loadAuthors, type AuthorAccount } from './data/authors.js';
import { accountRoutes } from './routes/account.js';
import { customerRoutes } from './routes/customers.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { pageRoutes } from './routes/page.js';

/** The demo BookLeaf product: its page, its own sign-in, and the customers endpoint. */
export async function buildHostApp(
  config: HostConfig,
  authors: AuthorAccount[] = loadAuthors(),
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cookie);
  // Liveness for the deploy check and the proxy; no data, no sign-in.
  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(customerRoutes, {
    authors,
    apiKey: config.HOST_API_KEY,
    dataAsOf: new Date(`${config.DATA_AS_OF}T00:00:00Z`),
  });
  await app.register(accountRoutes, {
    authors,
    password: config.HOST_DEMO_PASSWORD,
    signingSecret: config.HOST_SIGNING_SECRET,
    secureCookies: config.HOST_SECURE_COOKIES,
  });
  await app.register(dashboardRoutes, {
    authors,
    signingSecret: config.HOST_SIGNING_SECRET,
    dataAsOf: new Date(`${config.DATA_AS_OF}T00:00:00Z`),
  });
  await app.register(pageRoutes, {
    supportUrl: config.SUPPORT_URL,
    supportWorkspace: config.SUPPORT_WORKSPACE,
    webDist: config.HOST_WEB_DIST,
  });
  return app;
}
