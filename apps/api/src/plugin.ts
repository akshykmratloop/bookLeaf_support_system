import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import type { FastifyPluginAsync } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Env } from './config/index.js';
import { runInBackground } from './background.js';
import { createContainer, type Container } from './container.js';
import { MAX_FRAME_BYTES } from './modules/voice/gateway.js';
import { authGuard } from './platform/http/auth-guard.js';
import { CSP } from './platform/http/csp.js';
import { csrfGuard } from './platform/http/csrf.js';
import { allowEmbedding } from './platform/http/embed.js';
import { registerErrorHandler } from './platform/http/error-handler.js';
import { healthRoutes } from './platform/http/health.js';
import { registerSpa } from './platform/http/spa.js';
import { registerRoutes } from './routes.js';

export interface SupportPluginOptions {
  /** Validated settings (`loadEnv()`); used when no container is given. */
  env?: Env;
  /** Ready-made wiring, e.g. with test doubles. Takes precedence over `env`. */
  container?: Container;
}

/**
 * The whole support module as one Fastify plugin. It is encapsulated, so its security
 * plugins, error format and routes stay inside it, and a host app can mount it anywhere:
 *
 *   await app.register(supportPlugin, { prefix: '/support', env: loadEnv() });
 *
 * Routes are then served under `/support/api/v1/...` and `/support/health`. The AI worker
 * starts when the app is ready and stops when it closes.
 */
export const supportPlugin: FastifyPluginAsync<SupportPluginOptions> = async (app, opts) => {
  const c = opts.container ?? createContainer(requireEnv(opts.env));
  const background = runInBackground(app, c);
  app.addHook('onClose', async () => {
    await background.stop();
    if (!opts.container) await c.db.$disconnect();
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await app.register(helmet, { contentSecurityPolicy: { directives: CSP } });
  if (c.embedded) allowEmbedding(app, () => c.embedOrigins.list());
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(websocket, { options: { maxPayload: MAX_FRAME_BYTES } });
  await app.register(csrfGuard, { appOrigin: c.env.APP_ORIGIN });
  await app.register(healthRoutes, { db: c.db });
  await app.register(
    async (api) => {
      await api.register(authGuard, { sessions: c.sessions });
      await registerRoutes(api, c);
    },
    { prefix: '/api/v1' },
  );
  await registerSpa(app, c.env.WEB_DIST_DIR);
};

function requireEnv(env: Env | undefined): Env {
  if (!env) throw new Error('supportPlugin needs either `env` (from loadEnv()) or `container`');
  return env;
}
