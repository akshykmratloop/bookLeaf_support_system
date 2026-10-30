import type { PlatformProviderKey, PlatformSettings } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { LlmProvider } from '../../ai/providers/types.js';
import type { Db } from '../../platform/db.js';
import type { SharedStateLog } from '../../platform/shared-state/types.js';
import { createPlatformProviders, type PlatformProviderDeps } from './providers.js';

/**
 * The provider cache must not keep a failed load: one failed database read (a restart, a pool
 * timeout) would otherwise break every AI and voice call on the process until a restart.
 * The database is stood in for here because the cache logic, not the query, is under test.
 */
const ENV_AI = { id: 'anthropic' } as unknown as LlmProvider;

interface Reads {
  keys: ReturnType<typeof vi.fn<() => Promise<PlatformProviderKey[]>>>;
  settings: ReturnType<typeof vi.fn<() => Promise<PlatformSettings | null>>>;
}

function setup() {
  const reads: Reads = {
    keys: vi.fn<() => Promise<PlatformProviderKey[]>>().mockResolvedValue([]),
    settings: vi.fn<() => Promise<PlatformSettings | null>>().mockResolvedValue(null),
  };
  const db = {
    platformProviderKey: { findMany: reads.keys },
    platformSettings: { findUnique: reads.settings },
  } as unknown as Db;
  let nowMs = 1_000_000;
  const log: SharedStateLog = { warn: vi.fn(), error: vi.fn() };
  const deps: PlatformProviderDeps = {
    db,
    envelope: null,
    now: () => new Date(nowMs),
    log,
    envAi: new Map([['anthropic', ENV_AI]]),
    envVoice: null,
    envVoiceKey: undefined,
    voiceProviderId: 'openai',
    buildAi: () => undefined,
    buildVoice: () => null,
  };
  const advance = (ms: number) => {
    nowMs += ms;
  };
  return { reads, providers: createPlatformProviders(deps), advance };
}

describe('createPlatformProviders cache', () => {
  it('retries after the first load fails instead of keeping the failure', async () => {
    const { reads, providers } = setup();
    reads.keys.mockRejectedValueOnce(new Error('connection reset'));

    await expect(providers.ai('anthropic')).rejects.toThrow('connection reset');
    await expect(providers.ai('anthropic')).resolves.toBe(ENV_AI);
    await expect(providers.voice()).resolves.toBeNull();
  });

  it('retries after a refresh of stale state fails', async () => {
    const { reads, providers, advance } = setup();
    await expect(providers.ai('anthropic')).resolves.toBe(ENV_AI);

    advance(31_000);
    reads.settings.mockRejectedValueOnce(new Error('pool timeout'));
    await expect(providers.ai('anthropic')).rejects.toThrow('pool timeout');
    await expect(providers.ai('anthropic')).resolves.toBe(ENV_AI);
    await expect(providers.savedKeys()).resolves.toEqual([]);
  });

  it('reuses fresh state without reading the database again', async () => {
    const { reads, providers } = setup();
    await providers.ai('anthropic');
    await providers.voice();
    expect(reads.keys).toHaveBeenCalledTimes(1);
  });
});
