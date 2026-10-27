import { describe, expect, it } from 'vitest';
import { liveCallLines } from './liveLines';
import { INITIAL_VIEW, type CallView } from './view';

const lines: CallView['lines'] = [
  { role: 'AUTHOR', text: 'When will I get paid?' },
  { role: 'ASSISTANT', text: 'Your royalty rolls over.' },
];
const view = (patch: Partial<CallView>): CallView => ({ ...INITIAL_VIEW, ...patch });

describe('liveCallLines', () => {
  it('shows what is being said while the call is on', () => {
    expect(liveCallLines(view({ phase: 'live', callId: 'c1', lines }), [])).toEqual(lines);
  });

  it('keeps showing them after the call ends, until the chat has saved them', () => {
    const ended = view({ phase: 'ended', callId: 'c1', lines });
    expect(liveCallLines(ended, [{ callId: null }])).toEqual(lines);
    expect(liveCallLines(ended, [{ callId: 'c1' }])).toEqual([]);
  });

  it('shows nothing when there is no call', () => {
    expect(liveCallLines(view({}), [])).toEqual([]);
    expect(liveCallLines(view({ phase: 'failed', lines }), [])).toEqual([]);
  });
});
