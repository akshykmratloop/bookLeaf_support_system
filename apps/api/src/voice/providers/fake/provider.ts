import {
  VoiceProviderError,
  type VoiceEvent,
  type VoiceProvider,
  type VoiceSession,
  type VoiceSessionConfig,
} from '../types.js';

export interface FakeVoiceProvider extends VoiceProvider {
  /** Push a provider event into the live call. */
  emit(e: VoiceEvent): void;
  config: VoiceSessionConfig | null;
  audioIn: Buffer[];
  toolResults: { callId: string; result: Record<string, unknown> }[];
  said: string[];
  /** Notes added with addContext, in order. */
  context: string[];
  greeted: number;
  closed: boolean;
  /** Make the next connect fail with this code. */
  failNextConnect: VoiceProviderError['code'] | null;
}

/** The session handed to the call: it only records what the call sent. */
function recordingSession(fake: FakeVoiceProvider, stop: () => void): VoiceSession {
  return {
    sendAudio: (pcm16) => fake.audioIn.push(pcm16),
    sendToolResult: (callId, result) => fake.toolResults.push({ callId, result }),
    say: (text) => fake.said.push(text),
    addContext: (text) => fake.context.push(text),
    greet: () => {
      fake.greeted += 1;
    },
    close: () => {
      fake.closed = true;
      stop();
    },
  };
}

/** In-memory speech-to-speech provider for tests and keyless local runs. */
export function fakeVoiceProvider(): FakeVoiceProvider {
  let listener: ((e: VoiceEvent) => void) | null = null;
  const fake: FakeVoiceProvider = {
    id: 'fake',
    model: 'fake-realtime',
    inputSampleRate: 24_000,
    outputSampleRate: 24_000,
    voices: ['marin', 'cedar', 'alloy'],
    config: null,
    audioIn: [],
    toolResults: [],
    said: [],
    context: [],
    greeted: 0,
    closed: false,
    failNextConnect: null,
    emit: (e) => listener?.(e),
    async connect(config, onEvent) {
      if (fake.failNextConnect) {
        const code = fake.failNextConnect;
        fake.failNextConnect = null;
        throw new VoiceProviderError(code, 'fake connect failure');
      }
      fake.config = config;
      fake.closed = false;
      listener = onEvent;
      return recordingSession(fake, () => {
        listener = null;
      });
    },
  };
  return fake;
}
