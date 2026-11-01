import { AiError } from '../../ai/providers/errors.js';
import { VoiceProviderError, type VoiceSessionConfig } from '../../voice/providers/types.js';
import type { PlatformAiDeps } from './ai-status.js';
import type { TestResult, TestResults } from './last-test.js';

/** A voice session that is opened and closed again: nothing is spoken, so no audio is billed. */
const PROBE_SESSION: VoiceSessionConfig = {
  instructions: 'Connection test from the support console. Do not speak.',
  tools: [],
  language: null,
  greeting: '',
};

/** A tiny live call with the triage model on the active key. Vendor error text is never shown. */
async function testAi(deps: PlatformAiDeps): Promise<TestResult> {
  const s = await deps.ai.settings();
  const provider = await deps.ai.provider(s.provider);
  if (!provider)
    return { ok: false, detail: 'No API key is saved or configured for this provider' };
  try {
    await provider.ping(s.triageModel);
    return { ok: true, detail: `${s.triageModel} responded` };
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return { ok: false, detail: `Failed: ${err.code}` };
  }
}

/** Opens a session on the active voice key and model, then closes it. */
async function testVoice(deps: PlatformAiDeps): Promise<TestResult> {
  const voice = await deps.providers.voice();
  if (!voice) return { ok: false, detail: 'No voice API key is saved or configured' };
  try {
    const session = await voice.connect(PROBE_SESSION, () => undefined);
    session.close();
    return { ok: true, detail: `${voice.model} connected` };
  } catch (err) {
    if (!(err instanceof VoiceProviderError)) throw err;
    return { ok: false, detail: `Failed: ${err.code}` };
  }
}

/** "Run test" in the console: both providers at once, so one slow vendor does not hold up the other. */
export async function testConnections(deps: PlatformAiDeps): Promise<TestResults> {
  const [ai, voice] = await Promise.all([testAi(deps), testVoice(deps)]);
  return { ai, voice };
}
