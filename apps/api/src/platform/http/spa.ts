import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/**
 * Serves the built web app from the same origin as the API (no CORS, first-party cookies).
 * Unknown non-API GET paths return index.html so client-side routes work on refresh.
 */
export async function registerSpa(app: FastifyInstance, distDir: string | undefined): Promise<boolean> {
  if (!distDir) return false;
  const root = resolve(distDir);
  if (!existsSync(resolve(root, 'index.html'))) {
    app.log.warn({ root }, 'web build not found; serving API only');
    return false;
  }
  await app.register(fastifyStatic, { root, wildcard: false, index: false, maxAge: '1h', immutable: false });
  app.get('/*', { config: { public: true }, schema: { hide: true } }, (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.callNotFound();
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
  return true;
}
