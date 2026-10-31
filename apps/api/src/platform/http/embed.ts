import { LEGACY_EMBED_SECTIONS } from '@bookleaf/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { allowWidgetImages } from './csp.js';
import { framedFrom } from './widget-load.js';

/** Which origins may frame one workspace's widget page; null when no workspace has the slug. */
export interface WidgetFraming {
  originsFor(slug: string): Promise<readonly string[] | null>;
}

export interface WidgetPageOptions {
  framing: WidgetFraming;
  /** Where the old shared `/embed` address leads (BookLeaf). */
  defaultSlug: string;
  /** Embed mode: a workspace's allowed origins may frame its page. Off: full page only. */
  embedded: boolean;
  /** Called when one of the workspace's allowed sites frames its page (the U-12 setup guide). */
  onFramed?: (slug: string, origin: string) => Promise<void>;
}

const NO_CACHE = 'no-cache';
/** A path whose last segment has an extension: a file, never a page of the app. */
const FILE_PATH = /\/[^/]+\.[a-z0-9]+$/i;
const LEGACY = new Set<string>(LEGACY_EMBED_SECTIONS);

const Params = z.object({
  workspace: z.string().max(200),
  '*': z.string().max(2000).optional(),
});
type Params = z.infer<typeof Params>;
const PUBLIC = { config: { public: true }, schema: { hide: true } } as const;
const PAGE = { ...PUBLIC, schema: { ...PUBLIC.schema, params: Params } } as const;

/** The path without its query string, relative to where the module is mounted. */
const pathOf = (url: string, prefix: string) => (url.split('?')[0] ?? '').slice(prefix.length);
const queryOf = (url: string) => (url.includes('?') ? url.slice(url.indexOf('?')) : '');

function allowFraming(reply: FastifyReply, origins: readonly string[]): void {
  const csp = String(reply.getHeader('content-security-policy') ?? '');
  reply.header(
    'content-security-policy',
    csp.replace("frame-ancestors 'none'", `frame-ancestors ${origins.join(' ')}`),
  );
  reply.removeHeader('x-frame-options');
}

/** Any page may load the widget script (embed.js); every other file keeps same-origin. */
export function allowWidgetScript(app: FastifyInstance): void {
  app.addHook('onSend', async (req, reply) => {
    if (pathOf(req.url, app.prefix) === '/embed.js')
      reply.header('cross-origin-resource-policy', 'cross-origin');
  });
}

/**
 * Tells the setup guide which allowed site framed the page. Only a setup tick: if recording it
 * fails, the error is logged and the customer still gets the widget.
 */
async function noteFramed(
  req: FastifyRequest,
  slug: string,
  origins: readonly string[],
  onFramed: WidgetPageOptions['onFramed'],
): Promise<void> {
  const site = onFramed ? framedFrom(req.headers, origins) : null;
  if (!site || !onFramed) return;
  try {
    await onFramed(slug, site);
  } catch (err) {
    req.log.error({ err, slug }, 'could not record the widget load for the setup guide');
  }
}

/**
 * The widget page of one workspace: `/embed/<slug>` and the author app's pages under it. Its
 * frame-ancestors lists only that workspace's origins; every other page keeps
 * `frame-ancestors 'none'` (no clickjacking). An unknown slug is a 404. The old shared `/embed`
 * address (and its `/embed/tickets/…` pages) redirect to the default workspace's, so existing
 * host pages keep working; the browser keeps the `#t=` token across the redirect.
 */
export function registerWidgetPages(app: FastifyInstance, opts: WidgetPageOptions): void {
  const base = `${app.prefix}/embed`;
  /** The same page under the default workspace, from the raw (still percent-encoded) URL. */
  const toDefault = (req: FastifyRequest) => {
    const rest = pathOf(req.url, app.prefix).slice('/embed'.length);
    return `${base}/${opts.defaultSlug}${rest}${queryOf(req.url)}`;
  };

  app.get('/embed', PUBLIC, (req, reply) => reply.redirect(toDefault(req), 302));

  const page = async (req: FastifyRequest<{ Params: Params }>, reply: FastifyReply) => {
    const { workspace } = req.params;
    if (LEGACY.has(workspace)) return reply.redirect(toDefault(req), 302);
    if (FILE_PATH.test(pathOf(req.url, app.prefix))) return reply.callNotFound();
    const origins = await opts.framing.originsFor(workspace);
    if (!origins) return reply.callNotFound();
    allowWidgetImages(reply);
    if (opts.embedded && origins.length > 0) {
      allowFraming(reply, origins);
      await noteFramed(req, workspace, origins, opts.onFramed);
    }
    return reply.header('cache-control', NO_CACHE).sendFile('index.html');
  };
  app.get('/embed/:workspace', PAGE, page);
  app.get('/embed/:workspace/*', PAGE, page);
}
