import type { PlatformAiTestRun } from '@bookleaf/shared';

export interface TestRunToast {
  tone: 'success' | 'error';
  message: string;
}

/** One toast for a "Run test" that checked both keys: green only when both work. */
export function testRunToast(run: PlatformAiTestRun): TestRunToast {
  if (run.ai.ok && run.voice.ok)
    return {
      tone: 'success',
      message: `AI and voice both work. ${run.ai.detail}; ${run.voice.detail}.`,
    };
  const failed = [
    run.ai.ok ? null : `AI: ${run.ai.detail}`,
    run.voice.ok ? null : `Voice: ${run.voice.detail}`,
  ].filter((line): line is string => line !== null);
  return { tone: 'error', message: failed.join(' · ') };
}
