import { describe, expect, it } from 'vitest';
import { callNotice } from './endText';
import { INITIAL_VIEW } from './view';

describe('callNotice', () => {
  it('says why the call ended, including the conversation limit', () => {
    const view = { ...INITIAL_VIEW, phase: 'ended' as const, endReason: 'TURN_LIMIT' as const };
    expect(callNotice(view, null)).toEqual({
      text: 'This conversation reached its message limit, so the call ended.',
      isError: false,
    });
  });

  it('says the call ended because the caller could not be heard', () => {
    const view = { ...INITIAL_VIEW, phase: 'ended' as const, endReason: 'IDLE' as const };
    expect(callNotice(view, null)).toEqual({
      text: "The call ended because we couldn't hear you.",
      isError: false,
    });
  });

  it('shows a start problem or a failed call as an error', () => {
    expect(callNotice(INITIAL_VIEW, 'Could not start the call.')?.isError).toBe(true);
    const failed = { ...INITIAL_VIEW, phase: 'failed' as const, error: 'Microphone blocked' };
    expect(callNotice(failed, null)).toEqual({ text: 'Microphone blocked', isError: true });
  });

  it('says nothing when no call has happened', () => {
    expect(callNotice(INITIAL_VIEW, null)).toBeNull();
  });
});
