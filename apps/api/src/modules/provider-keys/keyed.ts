import type { WorkspaceProviderKey } from '@prisma/client';
import type { LlmProvider } from '../../ai/providers/types.js';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import { decryptKey, listKeys } from './store.js';
import { withWorkspace } from '../../platform/tenancy.js';

/** Which provider client a workspace runs on: its own key's, else the platform's. */
export interface KeyedProviders {
  ai(workspaceId: string, providerId: string): Promise<LlmProvider | undefined>;
  voice(workspaceId: string): Promise<VoiceProvider | null>;
  invalidate(workspaceId: string): void;
}

export interface KeyedDeps {
  db: Db;
  envelope: Envelope | null;
  now: () => Date;
  platformAi: ReadonlyMap<string, LlmProvider>;
  platformVoice: VoiceProvider | null;
  buildAi: (providerId: string, apiKey: string) => LlmProvider | undefined;
  buildVoice: (providerId: string, apiKey: string) => VoiceProvider | null;
}

interface Own {
  ai: { provider: string; client: LlmProvider | undefined } | null;
  voice: VoiceProvider | null | undefined;
  at: number;
}

const CACHE_MS = 30_000;

/** Builds a client from a saved key; a key that cannot be read gives no client, never the platform's. */
function clientFor<T>(deps: KeyedDeps, row: WorkspaceProviderKey, build: (key: string) => T) {
  if (!deps.envelope) return null;
  try {
    return build(decryptKey(deps.envelope, row));
  } catch {
    return null;
  }
}

async function loadOwn(deps: KeyedDeps, workspaceId: string, at: number): Promise<Own> {
  // Cached per workspace, so always read as that workspace, whoever asks first (S.8).
  const rows = await withWorkspace(workspaceId, () => listKeys(deps.db, workspaceId));
  const ai = rows.find((r) => r.capability === 'AI');
  const voice = rows.find((r) => r.capability === 'VOICE');
  return {
    at,
    ai: ai
      ? {
          provider: ai.provider,
          client: clientFor(deps, ai, (k) => deps.buildAi(ai.provider, k)) ?? undefined,
        }
      : null,
    // undefined: no own key (use the platform's); null: an own key that cannot be used.
    voice: voice ? clientFor(deps, voice, (k) => deps.buildVoice(voice.provider, k)) : undefined,
  };
}

/**
 * A workspace with its own key uses only that key for that capability, so its usage is never
 * billed to the platform by accident. Clients are cached so a call does not rebuild them.
 */
export function createKeyedProviders(deps: KeyedDeps): KeyedProviders {
  const cache = new Map<string, Own>();
  const own = async (workspaceId: string) => {
    const t = deps.now().getTime();
    const hit = cache.get(workspaceId);
    if (hit && t - hit.at < CACHE_MS) return hit;
    const fresh = await loadOwn(deps, workspaceId, t);
    cache.set(workspaceId, fresh);
    return fresh;
  };
  return {
    async ai(workspaceId, providerId) {
      const mine = (await own(workspaceId)).ai;
      if (!mine) return deps.platformAi.get(providerId);
      return mine.provider === providerId ? mine.client : undefined;
    },
    async voice(workspaceId) {
      const mine = (await own(workspaceId)).voice;
      return mine === undefined ? deps.platformVoice : mine;
    },
    invalidate: (workspaceId) => {
      cache.delete(workspaceId);
    },
  };
}
