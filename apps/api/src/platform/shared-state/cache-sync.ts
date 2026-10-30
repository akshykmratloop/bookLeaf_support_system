import { z } from 'zod';
import { sharedChannel, type SharedChannel } from './channel.js';
import type { SharedState, SharedStateLog } from './types.js';

const CacheDrop = z.object({
  cache: z.string().min(1).max(64),
  /** The entry to forget; '' means every entry of that cache. */
  key: z.string().max(200),
});
type CacheDrop = z.infer<typeof CacheDrop>;

/** Something with a local cache that can forget one entry, or all entries. */
export interface Forgetful {
  invalidate(key: string): void;
}

export interface CacheSync {
  /**
   * Returns `cache` with an `invalidate` that clears the entry on this copy at once and on every
   * other copy through pub/sub, so a saved setting is never served stale by another server.
   */
  shared<C extends Forgetful>(name: string, cache: C): C;
  ready: Promise<void>;
  close(): Promise<void>;
}

/**
 * Settings caches stay in each copy's memory (they are read on every request) and are cleared
 * everywhere when a setting is saved. Their short time limits remain as a safety net.
 */
export function createCacheSync(state: SharedState, log: SharedStateLog): CacheSync {
  const channel: SharedChannel<CacheDrop> = sharedChannel(state, 'cache-drop', CacheDrop, log);
  return {
    shared(name, cache) {
      channel.listen((drop) => {
        if (drop.cache === name) cache.invalidate(drop.key);
      });
      const invalidate = (key = '') => channel.publish({ cache: name, key });
      return { ...cache, invalidate };
    },
    ready: channel.ready,
    close: () => channel.close(),
  };
}
