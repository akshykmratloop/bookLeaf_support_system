import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Env } from './config/index.js';
import { runInBackground } from './background.js';
import { createContainer, type Container } from './container.js';
import { MAX_FRAME_BYTES } from './modules/voice/gateway.js';
import { chooseProtocol } from './modules/voice/stream-route.js';
import { recordWidgetLoad } from './modules/onboarding/signals.js';
import { DEFAULT_WORKSPACE_SLUG } from './modules/workspaces/constants.js';
import { authGuard } from './platform/http/auth-guard.js';
import { cspDirectives } from './platform/http/csp.js';
import { checkDbRoles } from './platform/db-role-check.js';
import { csrfGuard } from './platform/http/csrf.js';
import { sharedRateLimitStore } from './platform/http/rate-limit-store.js';
import { allowWidgetScript, registerWidgetPages } from './platform/http/embed.js';
import { registerErrorHandler } from './platform/http/error-handler.js';
import { healthRoutes } from './platform/http/health.js';
import { registerSpa } from './platform/http/spa.js';
import { registerPlatformRoutes, registerRoutes } from './routes.js';

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
  // Refuses to start when Redis (REDIS_URL) cannot be reached: shared state is not optional.
  await c.shared.ready();
  // Row-level security needs the restricted app role for requests and the owner for platform
  // work (S.8): production refuses to start without both, other environments warn.
  await checkDbRoles(c.db, c.env.NODE_ENV === 'production', app.log);
  const background = runInBackground(app, c);
  app.addHook('onClose', async () => {
    await background.stop();
    if (opts.container) return;
    await c.shared.close();
    await c.db.$disconnect();
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await app.register(helmet, {
    contentSecurityPolicy: { directives: cspDirectives(c.env.PUBLIC_API_WS_ORIGIN) },
  });
  if (c.embedded) allowWidgetScript(app);
  await app.register(cookie);
  // Counted in shared state, so every copy of the API adds up to one limit (F-19).
  await app.register(rateLimit, {
    global: false,
    store: sharedRateLimitStore(c.shared.state.counters),
  });
  await app.register(websocket, {
    options: { maxPayload: MAX_FRAME_BYTES, handleProtocols: chooseProtocol },
  });
  await app.register(csrfGuard, { appOrigin: c.env.APP_ORIGIN });
  await app.register(healthRoutes, { db: c.db, shared: c.shared.state });
  await registerApi(app, c);
  if (await registerSpa(app, c.env.WEB_DIST_DIR))
    registerWidgetPages(app, {
      framing: c.embedOrigins,
      defaultSlug: DEFAULT_WORKSPACE_SLUG,
      embedded: c.embedded,
      onFramed: (slug, origin) => recordWidgetLoad(c.db, slug, origin, c.clock.now()),
    });
};

/** The customer API and, beside it, the super admin console (U-7), each with its own guard. */
async function registerApi(app: FastifyInstance, c: Container): Promise<void> {
  await app.register(
    async (api) => {
      await api.register(authGuard, { sessions: c.sessions });
      await registerRoutes(api, c);
    },
    { prefix: '/api/v1' },
  );
  await app.register((api) => registerPlatformRoutes(api, c), { prefix: '/api/v1/platform' });
}

function requireEnv(env: Env | undefined): Env {
  if (!env) throw new Error('supportPlugin needs either `env` (from loadEnv()) or `container`');
  return env;
}
