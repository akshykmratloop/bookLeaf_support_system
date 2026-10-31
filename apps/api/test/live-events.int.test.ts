import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, createTicket, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let base: string;
let priya: string;
let rohit: string;
let admin: string;

interface Stream {
  events: { type: string; ticketId: string }[];
  close: () => void;
  /** Resolves when the server ends the stream. */
  ended: Promise<void>;
}

/** Opens /events over real HTTP and collects every `ticket` event it receives. */
async function listen(cookie: string, at = base): Promise<Stream> {
  const ctrl = new AbortController();
  const res = await fetch(`${at}/api/v1/events`, { headers: { cookie }, signal: ctrl.signal });
  expect(res.headers.get('content-type')).toContain('text/event-stream');
  const events: Stream['events'] = [];
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  const ended = (async () => {
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: '', done: true }));
      if (done) return;
      buf += value;
      for (const m of buf.matchAll(/event: ticket\ndata: (.+)\n\n/g))
        events.push(JSON.parse(m[1]!));
      buf = buf.slice(buf.lastIndexOf('\n\n') + 2);
    }
  })();
  return { events, close: () => ctrl.abort(), ended };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i += 1) await new Promise((r) => setTimeout(r, 40));
};

beforeAll(async () => {
  h = await createHarness();
  await h.app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(h.app.server.address() as AddressInfo).port}`;
  [priya, rohit, admin] = await Promise.all([
    h.login(EMAILS.priya),
    h.login(EMAILS.rohit),
    h.login(EMAILS.admin),
  ]);
});
afterAll(() => h.close());

describe('live updates over Server-Sent Events', () => {
  it("the author hears a staff reply on their ticket; notes and other authors' streams stay quiet", async () => {
    const created = await createTicket(h, priya, {
      bookId: null,
      subject: 'Live update test',
      description: 'Checking that a staff reply reaches me without a page refresh.',
    });
    const id = created.json<{ id: string }>().id;
    const [mine, other] = await Promise.all([listen(priya), listen(rohit)]);

    await call(h, 'POST', `/tickets/${id}/messages`, admin, {
      body: 'Internal: checking payout records.',
      kind: 'INTERNAL_NOTE',
    });
    await call(h, 'POST', `/tickets/${id}/messages`, admin, {
      body: 'Hi Priya, thank you for writing in. Our team will get back to you within 48 hours. Warm regards, BookLeaf Author Support',
    });
    await until(() => mine.events.some((e) => e.type === 'ticket.replied'));
    mine.close();
    other.close();

    expect(mine.events).toContainEqual({ type: 'ticket.replied', ticketId: id });
    expect(mine.events.map((e) => e.type)).not.toContain('ticket.note_added');
    expect(other.events.filter((e) => e.ticketId === id)).toEqual([]);
  });

  it('refuses a stream without a sign-in (401)', async () => {
    const res = await fetch(`${base}/api/v1/events`);
    expect(res.status).toBe(401);
  });
});

describe('shutdown', () => {
  it('ends open streams, so closing the server does not wait on them', async () => {
    const other = await createHarness();
    await other.app.listen({ port: 0, host: '127.0.0.1' });
    const at = `http://127.0.0.1:${(other.app.server.address() as AddressInfo).port}`;
    const stream = await listen(await other.login(EMAILS.kavita), at);
    const started = Date.now();
    await other.close();
    await stream.ended;
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
