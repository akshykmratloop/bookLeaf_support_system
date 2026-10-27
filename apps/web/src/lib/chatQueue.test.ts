import { describe, expect, it } from 'vitest';
import { MessageQueue } from './chatQueue';

/** A deliver function the test resolves or rejects by hand, to watch the queue in between. */
function controlled() {
  const calls: { text: string; resolve: () => void; reject: (e: Error) => void }[] = [];
  const deliver = (text: string) =>
    new Promise<void>((resolve, reject) => calls.push({ text, resolve, reject }));
  return { calls, deliver };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const statuses = (q: MessageQueue) => q.snapshot().map((m) => `${m.text}:${m.status}`);

describe('MessageQueue', () => {
  it('lets the author send several messages and delivers them one at a time, in order', async () => {
    const { calls, deliver } = controlled();
    const q = new MessageQueue(deliver, String);
    q.add('one');
    q.add('two');
    q.add('three');
    expect(calls.map((c) => c.text)).toEqual(['one']);
    expect(statuses(q)).toEqual(['one:sending', 'two:waiting', 'three:waiting']);
    calls[0]?.resolve();
    await flush();
    expect(calls.map((c) => c.text)).toEqual(['one', 'two']);
    calls[1]?.resolve();
    await flush();
    calls[2]?.resolve();
    await flush();
    expect(q.snapshot()).toEqual([]);
  });

  it('pauses on a failed message until it is retried, keeping the order', async () => {
    const { calls, deliver } = controlled();
    const q = new MessageQueue(deliver, (e) => (e as Error).message);
    q.add('one');
    q.add('two');
    calls[0]?.reject(new Error('Network down'));
    await flush();
    expect(statuses(q)).toEqual(['one:failed', 'two:waiting']);
    expect(q.snapshot()[0]?.error).toBe('Network down');
    expect(calls).toHaveLength(1);
    q.retry(q.snapshot()[0]?.localId ?? '');
    expect(calls.map((c) => c.text)).toEqual(['one', 'one']);
  });

  it('moves on to the next message when a failed one is removed', async () => {
    const { calls, deliver } = controlled();
    const q = new MessageQueue(deliver, String);
    q.add('one');
    q.add('two');
    calls[0]?.reject(new Error('x'));
    await flush();
    q.remove(q.snapshot()[0]?.localId ?? '');
    expect(calls.map((c) => c.text)).toEqual(['one', 'two']);
  });

  it('clear() drops every message, and an answer still on its way does not bring one back', async () => {
    const { calls, deliver } = controlled();
    const q = new MessageQueue(deliver, String);
    q.add('old one');
    q.add('old two');
    q.clear();
    expect(q.snapshot()).toEqual([]);
    q.add('new');
    calls[0]?.resolve();
    await flush();
    expect(statuses(q)).toEqual(['new:sending']);
    expect(calls.map((c) => c.text)).toEqual(['old one', 'new']);
  });
});
