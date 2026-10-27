import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Container } from './container.js';
import { aiAdminRoutes } from './modules/ai-admin/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { booksRoutes } from './modules/books/routes.js';
import { draftRoutes } from './modules/drafts/routes.js';
import { eventRoutes } from './modules/events/routes.js';
import { ticketRoutes } from './modules/tickets/routes.js';
import { authGuard } from './platform/http/auth-guard.js';
import { csrfGuard } from './platform/http/csrf.js';
import { registerErrorHandler } from './platform/http/error-handler.js';
import { healthRoutes } from './platform/http/health.js';
import { registerSpa } from './platform/http/spa.js';

const BODY_LIMIT = 64 * 1024;
const REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.apiKey',
  '*.password',
  '*.token',
];

const CSP = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
};

export async function buildApp(c: Container): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      c.env.NODE_ENV === 'test'
        ? false
        : { level: c.env.LOG_LEVEL, redact: { paths: REDACT, censor: '[redacted]' } },
    bodyLimit: BODY_LIMIT,
    trustProxy: c.env.NODE_ENV === 'production',
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(helmet, { contentSecurityPolicy: { directives: CSP } });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(csrfGuard, { appOrigin: c.env.APP_ORIGIN });
  await app.register(authGuard, { sessions: c.sessions });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'BookLeaf Author Support API',
        version: '1.0.0',
        description: 'Session cookie auth. Errors are RFC 7807 problem+json.',
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  await app.register(healthRoutes, { db: c.db });
  await app.register(
    async (api) => {
      await api.register(authRoutes, {
        auth: c.auth,
        ttlSeconds: c.sessions.ttlSeconds,
        secureCookies: c.env.NODE_ENV === 'production',
      });
      await api.register(booksRoutes, { books: c.books });
      await api.register(ticketRoutes, { deps: c.ticketDeps });
      await api.register(draftRoutes, { deps: c.ticketDeps });
      await api.register(aiAdminRoutes, { aiAdmin: c.aiAdmin });
      await api.register(eventRoutes, { events: c.events, sessions: c.sessions });
    },
    { prefix: '/api/v1' },
  );
  await registerSpa(app, c.env.WEB_DIST_DIR);
  return app;
}
