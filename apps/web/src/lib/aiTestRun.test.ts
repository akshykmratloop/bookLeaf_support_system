import { describe, expect, it } from 'vitest';
import { testRunToast } from './aiTestRun';

const ok = (detail: string) => ({ ok: true, detail });
const failed = (detail: string) => ({ ok: false, detail });

describe('testRunToast', () => {
  it('is green only when both the AI and the voice key work', () => {
    expect(
      testRunToast({ ai: ok('claude-haiku-5-5 responded'), voice: ok('gpt-realtime connected') }),
    ).toEqual({
      tone: 'success',
      message: 'AI and voice both work. claude-haiku-5-5 responded; gpt-realtime connected.',
    });
  });

  it('names only the key that failed', () => {
    expect(testRunToast({ ai: ok('x responded'), voice: failed('Failed: VOICE_AUTH') })).toEqual({
      tone: 'error',
      message: 'Voice: Failed: VOICE_AUTH',
    });
  });

  it('lists both when both fail', () => {
    expect(
      testRunToast({ ai: failed('Failed: AI_AUTH'), voice: failed('No voice API key') }).message,
    ).toBe('AI: Failed: AI_AUTH · Voice: No voice API key');
  });
});
