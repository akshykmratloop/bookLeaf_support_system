import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const NO_CACHE = 'no-cache';
const HASHED_ASSET = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=3600';
/** A path whose last segment has an extension, e.g. /assets/index-abc.js or /logo.png. */
const FILE_PATH = /\/[^/]+\.[a-z0-9]+$/i;

/**
 * index.html and the widget script (embed.js, loaded by host pages under a fixed name) must be
 * revalidated on every load, or users keep running the previous release after a deploy; the ETag
 * makes that a cheap 304. Files under /assets/ carry a content hash in their name, so never change.
 */
function cacheControlFor(path: string): string {
  if (path.endsWith('index.html') || /[\\/]embed\.js$/.test(path)) return NO_CACHE;
  if (/[\\/]assets[\\/]/.test(path)) return HASHED_ASSET;
  return SHORT;
}

/**
 * Serves the built web app from the same origin as the API (no CORS, first-party cookies).
 * Unknown non-API GET paths return index.html so client-side routes work on refresh.
 */
export async function registerSpa(
  app: FastifyInstance,
  distDir: string | undefined,
): Promise<boolean> {
  if (!distDir) return false;
  const root = resolve(distDir);
  if (!existsSync(resolve(root, 'index.html'))) {
    app.log.warn({ root }, 'web build not found; serving API only');
    return false;
  }
  await app.register(fastifyStatic, {
    root,
    wildcard: false,
    index: false,
    cacheControl: false,
    setHeaders: (reply, path) => {
      reply.header('cache-control', cacheControlFor(path));
    },
  });
  app.get('/*', { config: { public: true }, schema: { hide: true } }, (req, reply) => {
    // Only page routes fall back to index.html; a missing file (old bundle, typo) is a real 404.
    const path = (req.url.split('?')[0] ?? '').slice(app.prefix.length);
    if (path.startsWith('/api/') || FILE_PATH.test(path)) return reply.callNotFound();
    return reply.header('cache-control', NO_CACHE).sendFile('index.html');
  });
  return true;
}
