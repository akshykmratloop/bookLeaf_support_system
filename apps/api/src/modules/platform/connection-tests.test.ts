import { describe, expect, it } from 'vitest';
import type { AiRuntime } from '../../ai/jobs/runtime.js';
import { AiAuthError } from '../../ai/providers/errors.js';
import type { LlmProvider } from '../../ai/providers/types.js';
import { fakeVoiceProvider, type FakeVoiceProvider } from '../../voice/providers/fake/provider.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import type { PlatformAiDeps } from './ai-status.js';
import { testConnections } from './connection-tests.js';
import type { PlatformProviders } from './providers.js';

/**
 * "Run test" checks both keys the platform runs on: the AI (text) key with a tiny request, and
 * the voice key by opening a session and closing it at once. Only the providers are stood in for:
 * the test logic, not the vendors, is under test here.
 */
function deps(opts: { ai?: LlmProvider; voice: VoiceProvider | null }): PlatformAiDeps {
  const ai = {
    settings: async () => ({ provider: 'anthropic', triageModel: 'claude-haiku-5-5' }),
    provider: async () => opts.ai,
  } as unknown as AiRuntime;
  const providers = { voice: async () => opts.voice } as unknown as PlatformProviders;
  return { ai, providers } as unknown as PlatformAiDeps;
}

const workingAi = { ping: async () => undefined } as unknown as LlmProvider;

describe('testConnections', () => {
  it('reports both providers working, and closes the voice session it opened', async () => {
    const voice: FakeVoiceProvider = fakeVoiceProvider();
    const r = await testConnections(deps({ ai: workingAi, voice }));
    expect(r.ai).toEqual({ ok: true, detail: 'claude-haiku-5-5 responded' });
    expect(r.voice).toEqual({ ok: true, detail: 'fake-realtime connected' });
    expect(voice.closed).toBe(true);
    expect(voice.greeted).toBe(0);
  });

  it('shows the voice error code (never vendor text) when the voice key is refused', async () => {
    const voice = fakeVoiceProvider();
    voice.failNextConnect = 'VOICE_AUTH';
    const r = await testConnections(deps({ ai: workingAi, voice }));
    expect(r.voice).toEqual({ ok: false, detail: 'Failed: VOICE_AUTH' });
    expect(r.ai.ok).toBe(true);
  });

  it('says so when no voice key is saved or configured, without failing the AI test', async () => {
    const r = await testConnections(deps({ ai: workingAi, voice: null }));
    expect(r.voice).toEqual({ ok: false, detail: 'No voice API key is saved or configured' });
    expect(r.ai.ok).toBe(true);
  });

  it('keeps the AI result separate from the voice result', async () => {
    const failingAi = {
      ping: async () => {
        throw new AiAuthError('refused');
      },
    } as unknown as LlmProvider;
    const r = await testConnections(deps({ ai: failingAi, voice: fakeVoiceProvider() }));
    expect(r.ai).toEqual({ ok: false, detail: 'Failed: AI_AUTH' });
    expect(r.voice.ok).toBe(true);
  });
});
