import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import type { FastifyPluginAsync } from 'fastify';

interface Options {
  supportUrl: string;
  /** BookLeaf's workspace slug in the support module (its widget is `/embed/<slug>`). */
  supportWorkspace: string;
  /** The built author dashboard (apps/host-web/dist). */
  webDist: string;
}

const NOT_BUILT = `<!doctype html><meta charset="utf-8"><title>BookLeaf</title>
<p style="font:15px system-ui;padding:24px">The author dashboard is not built yet. Run
<code>pnpm --filter @bookleaf/host-web build</code>, or open the dev server on port 5174.</p>`;

/**
 * BookLeaf's web app: the author dashboard (a React app built into webDist) and the settings it
 * needs from the server: the support module's address and BookLeaf's workspace there.
 */
export const pageRoutes: FastifyPluginAsync<Options> = async (app, opts) => {
  app.get('/api/config', async () => ({
    supportUrl: opts.supportUrl,
    supportWorkspace: opts.supportWorkspace,
  }));
  if (!existsSync(`${opts.webDist}/index.html`)) {
    app.get('/', async (_req, reply) => reply.type('text/html; charset=utf-8').send(NOT_BUILT));
    return;
  }
  await app.register(fastifyStatic, { root: opts.webDist, prefix: '/' });
};
