import type { FastifyInstance, FastifyReply } from 'fastify';

/** The path without its query string, relative to where the module is mounted. */
const pathOf = (url: string, prefix: string) => (url.split('?')[0] ?? '').slice(prefix.length);

const isWidgetPage = (path: string) => path === '/embed' || path.startsWith('/embed/');

function allowFraming(reply: FastifyReply, origins: readonly string[]): void {
  const csp = String(reply.getHeader('content-security-policy') ?? '');
  reply.header(
    'content-security-policy',
    csp.replace("frame-ancestors 'none'", `frame-ancestors ${origins.join(' ')}`),
  );
  reply.removeHeader('x-frame-options');
}

/**
 * Embed mode. The configured host origins may frame the widget page, and any page may load the
 * widget script. Every other page keeps `frame-ancestors 'none'` (no clickjacking) and a
 * same-origin resource policy.
 */
export function allowEmbedding(app: FastifyInstance, origins: readonly string[]): void {
  if (origins.length === 0) return;
  app.addHook('onSend', async (req, reply) => {
    const path = pathOf(req.url, app.prefix);
    if (path === '/embed.js') reply.header('cross-origin-resource-policy', 'cross-origin');
    if (isWidgetPage(path)) allowFraming(reply, origins);
  });
}
