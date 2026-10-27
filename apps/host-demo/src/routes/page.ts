import { readFileSync } from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';

const PUBLIC = new URL('../../public/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, PUBLIC), 'utf8');

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The demo product's single page and its script. */
export const pageRoutes: FastifyPluginAsync<{ supportUrl: string }> = async (app, opts) => {
  const html = read('page.html').replace('__SUPPORT_URL__', escapeHtml(opts.supportUrl));
  const script = read('page.js');
  app.get('/', async (_req, reply) => reply.type('text/html; charset=utf-8').send(html));
  app.get('/page.js', async (_req, reply) =>
    reply.type('text/javascript; charset=utf-8').send(script),
  );
};
