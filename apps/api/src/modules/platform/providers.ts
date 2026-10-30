import type { PlatformProviderKey, ProviderCapability } from '@prisma/client';
import type { LlmProvider } from '../../ai/providers/types.js';
import type { Envelope } from '../../platform/crypto/envelope.js';
import type { Db } from '../../platform/db.js';
import type { SharedStateLog } from '../../platform/shared-state/types.js';
import { asPlatform } from '../../platform/tenancy.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import { decryptPlatformKey, listPlatformKeys } from './keys.js';

/**
 * The AI and voice clients every customer runs on (U-7): a key saved in the console wins over the
 * server's env key for that provider. Customers never bring their own keys. A saved key that
 * cannot be decrypted gives no client (logged), never a silent fallback to another key.
 */
export interface PlatformProviders {
  ai(providerId: string): Promise<LlmProvider | undefined>;
  voice(): Promise<VoiceProvider | null>;
  /** The saved keys (never their values), for the console. */
  savedKeys(): Promise<PlatformProviderKey[]>;
  invalidate(key?: string): void;
}

export interface PlatformProviderDeps {
  db: Db;
  envelope: Envelope | null;
  now: () => Date;
  log: SharedStateLog;
  envAi: ReadonlyMap<string, LlmProvider>;
  envVoice: VoiceProvider | null;
  /** The env voice key, to rebuild the env client when the console picks another voice model. */
  envVoiceKey: string | undefined;
  voiceProviderId: string;
  buildAi: (providerId: string, apiKey: string) => LlmProvider | undefined;
  buildVoice: (providerId: string, apiKey: string, model: string | null) => VoiceProvider | null;
}

interface State {
  at: number;
  keys: PlatformProviderKey[];
  voiceModel: string | null;
}

const CACHE_MS = 30_000;

async function loadState(deps: PlatformProviderDeps): Promise<State> {
  const [keys, settings] = await Promise.all([
    listPlatformKeys(deps.db),
    asPlatform(() => deps.db.platformSettings.findUnique({ where: { id: 1 } })),
  ]);
  return { at: deps.now().getTime(), keys, voiceModel: settings?.voiceModel ?? null };
}

const savedFor = (s: State, capability: ProviderCapability, provider: string) =>
  s.keys.find((k) => k.capability === capability && k.provider === provider);

type Client = LlmProvider | VoiceProvider | null | undefined;
type FromSaved = <T>(
  row: PlatformProviderKey,
  tag: string,
  build: (key: string) => T,
) => T | undefined;

/** Builds a client once per saved key version; a key that cannot be read gives no client. */
function savedBuilder(deps: PlatformProviderDeps, built: Map<string, Client>): FromSaved {
  return <T>(row: PlatformProviderKey, tag: string, build: (key: string) => T) => {
    const id = `${tag}:${row.id}:${row.updatedAt.getTime()}`;
    if (built.has(id)) return built.get(id) as T | undefined;
    let client: T | undefined;
    try {
      client = deps.envelope ? build(decryptPlatformKey(deps.envelope, row)) : undefined;
    } catch (err) {
      deps.log.warn({ provider: row.provider, err: String(err) }, 'saved platform key unusable');
    }
    built.set(id, client as Client);
    return client;
  };
}

/** The voice client: the saved key, else the env key (rebuilt for a console-chosen model). */
function voiceClient(
  deps: PlatformProviderDeps,
  s: State,
  built: Map<string, Client>,
  fromSaved: FromSaved,
): VoiceProvider | null {
  const id = deps.voiceProviderId;
  const row = savedFor(s, 'VOICE', id);
  if (row)
    return (
      fromSaved(row, `voice:${s.voiceModel}`, (k) => deps.buildVoice(id, k, s.voiceModel)) ?? null
    );
  if (!s.voiceModel || !deps.envVoiceKey) return deps.envVoice;
  const key = `env-voice:${s.voiceModel}`;
  if (!built.has(key)) built.set(key, deps.buildVoice(id, deps.envVoiceKey, s.voiceModel));
  return (built.get(key) as VoiceProvider | null | undefined) ?? null;
}

export function createPlatformProviders(deps: PlatformProviderDeps): PlatformProviders {
  let state: Promise<State> | null = null;
  const built = new Map<string, Client>();
  const fromSaved = savedBuilder(deps, built);
  // A failed load is dropped, never cached: one failed read must not break every later call.
  const load = (): Promise<State> => {
    const next = loadState(deps);
    state = next;
    next.catch(() => {
      if (state === next) state = null;
    });
    return next;
  };
  const current = () => {
    const t = deps.now().getTime();
    return (state ?? load()).then((s) => (t - s.at < CACHE_MS ? s : load()));
  };
  return {
    async ai(providerId) {
      const row = savedFor(await current(), 'AI', providerId);
      if (!row) return deps.envAi.get(providerId);
      return fromSaved(row, 'ai', (k) => deps.buildAi(providerId, k));
    },
    voice: async () => voiceClient(deps, await current(), built, fromSaved),
    savedKeys: async () => (await current()).keys,
    invalidate: () => {
      state = null;
    },
  };
}
