import type { Db } from '../../platform/db.js';
import type { WidgetFraming } from '../../platform/http/embed.js';
import { asPlatform } from '../../platform/tenancy.js';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/constants.js';

/** Origins that may show a workspace's support widget (`/embed/<slug>`) in an iframe. */
export interface EmbedOrigins extends WidgetFraming {
  /** Forget cached lists, e.g. after a workspace saves its allowed origins. */
  invalidate(): void;
}

const CACHE_MS = 30_000;

/** Only a plain web origin may reach the frame-ancestors header (nothing that adds a directive). */
const SAFE_ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/;

const clean = (origins: readonly string[]): readonly string[] =>
  [...new Set(origins)].filter((o) => SAFE_ORIGIN.test(o)).sort();

/**
 * Each workspace's widget page may be framed by that workspace's own allowed origins only, plus
 * the env's HOST_ORIGINS for the default workspace (BookLeaf). Never the union of every
 * tenant's origins (F-18). Lists are cached briefly; an unknown slug is never cached, so a
 * workspace that has just signed up gets its page at once.
 */
export function createEmbedOrigins(
  db: Db,
  envOrigins: readonly string[],
  now: () => Date,
): EmbedOrigins {
  const cache = new Map<string, { list: readonly string[]; at: number }>();
  return {
    async originsFor(slug) {
      const t = now().getTime();
      const hit = cache.get(slug);
      if (hit && t - hit.at < CACHE_MS) return hit.list;
      // A public page, before anyone signs in: the slug lookup spans the platform (S.8).
      const workspace = await asPlatform(() =>
        db.workspace.findUnique({
          where: { slug },
          select: { id: true, settings: { select: { allowedOrigins: true } } },
        }),
      );
      if (!workspace) return null;
      const own = workspace.settings?.allowedOrigins ?? [];
      const list = clean(workspace.id === DEFAULT_WORKSPACE_ID ? [...envOrigins, ...own] : own);
      cache.set(slug, { list, at: t });
      return list;
    },
    invalidate: () => cache.clear(),
  };
}
