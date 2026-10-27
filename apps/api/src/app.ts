import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { jsonSchemaTransform, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Container } from './container.js';
import { supportPlugin } from './plugin.js';

const BODY_LIMIT = 64 * 1024;
const REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.apiKey',
  '*.password',
  '*.token',
];

function createServer(c: Container) {
  return Fastify({
    logger:
      c.env.NODE_ENV === 'test'
        ? false
        : { level: c.env.LOG_LEVEL, redact: { paths: REDACT, censor: '[redacted]' } },
    bodyLimit: BODY_LIMIT,
    trustProxy: c.env.NODE_ENV === 'production',
  }).withTypeProvider<ZodTypeProvider>();
}

/** OpenAPI document generated from the route schemas, browsable at /api/docs. */
async function registerDocs(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'BookLeaf Author Support API',
        version: '1.0.0',
        description:
          'Session cookie auth; the /server routes take a workspace API key instead. Errors are RFC 7807 problem+json.',
      },
      components: {
        securitySchemes: {
          apiKey: { type: 'http', scheme: 'bearer', description: 'Workspace API key (blsk_…)' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
}

/** The standalone server: API docs plus the support module mounted at the root. */
export async function buildApp(c: Container): Promise<FastifyInstance> {
  const app = createServer(c);
  await registerDocs(app);
  await app.register(supportPlugin, { container: c });
  return app;
}
