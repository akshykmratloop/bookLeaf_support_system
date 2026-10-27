import type { Db } from '../../platform/db.js';

/** Origins that may show the support widget in an iframe. */
export interface EmbedOrigins {
  list(): Promise<readonly string[]>;
  invalidate(): void;
}

const CACHE_MS = 30_000;

/** Only a plain web origin may reach the frame-ancestors header (nothing that adds a directive). */
const SAFE_ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/;

/**
 * The env's host origins plus every workspace's allowed origins. One widget page serves every
 * workspace, so its frame-ancestors list is the union; each workspace still signs its own users in.
 */
export function createEmbedOrigins(
  db: Db,
  envOrigins: readonly string[],
  now: () => Date,
): EmbedOrigins {
  let cached: { list: readonly string[]; at: number } | null = null;
  return {
    async list() {
      const t = now().getTime();
      if (cached && t - cached.at < CACHE_MS) return cached.list;
      const rows = await db.workspaceSettings.findMany({ select: { allowedOrigins: true } });
      const all = new Set([...envOrigins, ...rows.flatMap((r) => r.allowedOrigins)]);
      const list = [...all].filter((o) => SAFE_ORIGIN.test(o)).sort();
      cached = { list, at: t };
      return list;
    },
    invalidate: () => {
      cached = null;
    },
  };
}
