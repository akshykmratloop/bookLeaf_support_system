import type { ChatReply, ChatSession } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { ChatDelivery } from './chatDelivery';

const session = (id: string) => ({ id }) as ChatSession;

/** A chat API whose calls the test answers by hand, plus a one-value cache. */
function setup(initial: ChatSession | null) {
  let cached = initial;
  const starts: ((s: ChatSession) => void)[] = [];
  const sends: { id: string; text: string; answer: () => void }[] = [];
  const delivery = new ChatDelivery(
    { get: () => cached, set: (s) => (cached = s) },
    {
      start: () => new Promise<ChatSession>((r) => starts.push(r)),
      send: (id, text) =>
        new Promise<ChatReply>((r) =>
          sends.push({ id, text, answer: () => r({ session: session(`${id}+`) } as ChatReply) }),
        ),
    },
  );
  return { delivery, starts, sends, cached: () => cached };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ChatDelivery', () => {
  it('starts a conversation for the first message, then sends into it', async () => {
    const t = setup(null);
    const sent = t.delivery.deliver('hello');
    await flush();
    t.starts[0]?.(session('s1'));
    await flush();
    expect(t.cached()?.id).toBe('s1');
    expect(t.sends.map((s) => s.id)).toEqual(['s1']);
    t.sends[0]?.answer();
    await sent;
    expect(t.cached()?.id).toBe('s1+');
  });

  it('ignores an answer for the old conversation after New conversation', async () => {
    const t = setup(session('old'));
    const sent = t.delivery.deliver('question');
    await flush();
    const restarted = t.delivery.restart();
    t.starts[0]?.(session('new'));
    await restarted;
    t.sends[0]?.answer();
    await sent;
    expect(t.cached()?.id).toBe('new');
  });

  it('sends a message typed during New conversation into the new conversation', async () => {
    const t = setup(session('old'));
    const restarted = t.delivery.restart();
    const sent = t.delivery.deliver('first in new');
    await flush();
    expect(t.sends).toEqual([]);
    t.starts[0]?.(session('new'));
    await restarted;
    await flush();
    expect(t.sends.map((s) => s.id)).toEqual(['new']);
    t.sends[0]?.answer();
    await sent;
    expect(t.cached()?.id).toBe('new+');
  });

  it('keeps the newest of two quick New conversation presses', async () => {
    const t = setup(session('old'));
    const first = t.delivery.restart();
    const second = t.delivery.restart();
    t.starts[1]?.(session('second'));
    t.starts[0]?.(session('first'));
    await Promise.all([first, second]);
    expect(t.cached()?.id).toBe('second');
  });
});
