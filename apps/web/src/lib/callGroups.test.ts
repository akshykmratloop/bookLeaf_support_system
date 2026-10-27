import type { ChatMessage } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { chatLine, threadItems } from './callGroups';

const T0 = Date.parse('2026-10-28T10:00:00Z');

function msg(n: number, channel: ChatMessage['channel'], callId: string | null, atMin: number) {
  return {
    id: `m${n}`,
    role: n % 2 ? 'AUTHOR' : 'ASSISTANT',
    body: `line ${n}`,
    source: null,
    factsUsed: [],
    proposal: null,
    channel,
    callId,
    createdAt: new Date(T0 + atMin * 60_000).toISOString(),
  } satisfies ChatMessage;
}

describe('threadItems', () => {
  it('keeps a typed-only chat as plain messages', () => {
    const items = threadItems([msg(1, 'CHAT', null, 0), msg(2, 'CHAT', null, 1)], chatLine);
    expect(items.map((i) => i.kind)).toEqual(['message', 'message']);
  });

  it('puts a divider with the call length before each call’s spoken lines', () => {
    const items = threadItems(
      [
        msg(1, 'CHAT', null, 0),
        msg(2, 'CHAT', null, 0),
        msg(3, 'VOICE', 'c1', 2),
        msg(4, 'VOICE', 'c1', 5),
        msg(5, 'CHAT', null, 6),
        msg(6, 'VOICE', 'c2', 9),
      ],
      chatLine,
    );
    expect(
      items.map((i) => (i.kind === 'call' ? `call:${i.callId}:${i.minutes}` : i.kind)),
    ).toEqual([
      'message',
      'message',
      'call:c1:3',
      'message',
      'message',
      'message',
      'call:c2:1',
      'message',
    ]);
  });

  it('shows one divider per call even when a typed message landed inside it', () => {
    const items = threadItems(
      [msg(1, 'VOICE', 'c1', 0), msg(2, 'CHAT', null, 1), msg(3, 'VOICE', 'c1', 2)],
      chatLine,
    );
    expect(items.filter((i) => i.kind === 'call')).toHaveLength(1);
  });

  it('counts a call shorter than a minute as one minute', () => {
    const items = threadItems([msg(1, 'VOICE', 'c1', 0), msg(2, 'VOICE', 'c1', 0.2)], chatLine);
    expect(items[0]).toMatchObject({ kind: 'call', callId: 'c1', minutes: 1 });
  });

  it('groups the lines of a past conversation the same way', () => {
    const at = (m: number) => new Date(T0 + m * 60_000).toISOString();
    const lines = [
      { text: 'typed', callId: null, at: at(0) },
      { text: 'spoken', callId: 'c1', at: at(1) },
    ];
    expect(threadItems(lines, (l) => l).map((i) => i.kind)).toEqual(['message', 'call', 'message']);
  });
});
