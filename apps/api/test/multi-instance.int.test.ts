import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { AssistantSettings, TicketDraft } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGIN_ATTEMPTS_PER_ACCOUNT } from '../src/modules/auth/login-throttle.js';
import type { DraftChange } from '../src/modules/ticket-drafts/live.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import {
  call,
  createHarness,
  createTicket,
  EMAILS,
  hostTokenFor,
  type Harness,
} from './helpers/app.js';

/**
 * Two copies of the API on one Postgres and one Redis, like two servers behind a load balancer
 * (F-19). Whatever one copy does, the other must see.
 */
let a: Harness;
let b: Harness;
let priyaOnA: string;
let adminOnA: string;

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check: () => boolean | Promise<boolean>) => {
  for (let i = 0; i < 100 && !(await check()); i += 1) await later(20);
};

/** Opens /events on copy B over real HTTP and collects the ticket events it receives. */
async function listenOnB(cookie: string) {
  await b.app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${(b.app.server.address() as AddressInfo).port}`;
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/v1/events`, { headers: { cookie }, signal: ctrl.signal });
  const events: { type: string; ticketId: string }[] = [];
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  void (async () => {
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
  return { events, close: () => ctrl.abort() };
}

beforeAll(async () => {
  a = await createHarness();
  b = await createHarness({ sharedPrefix: a.redisPrefix, keepSettings: true });
  [priyaOnA, adminOnA] = await Promise.all([a.login(EMAILS.priya), a.login(EMAILS.admin)]);
});
afterAll(async () => {
  await b.close();
  await a.close();
});

describe('two copies of the API share their state through Redis', () => {
  it('a staff reply saved on copy A reaches the author listening on copy B', async () => {
    const created = await createTicket(a, priyaOnA, {
      bookId: null,
      subject: 'Two servers test',
      description: 'Checking that a reply on one server reaches me on the other server.',
    });
    const id = created.json<{ id: string }>().id;
    const stream = await listenOnB(await b.login(EMAILS.priya));
    await call(a, 'POST', `/tickets/${id}/messages`, adminOnA, {
      body: 'Hi Priya, thank you for writing in. Our team will get back to you within 48 hours. Warm regards, BookLeaf Author Support',
    });
    await until(() => stream.events.some((e) => e.ticketId === id && e.type === 'ticket.replied'));
    stream.close();
    expect(stream.events).toContainEqual({ type: 'ticket.replied', ticketId: id });
  });

  it('a host sign-in token used on copy A is refused on copy B', async () => {
    const token = await hostTokenFor(EMAILS.rohit);
    expect((await call(a, 'POST', '/auth/host', undefined, { token })).statusCode).toBe(200);
    const replay = await call(b, 'POST', '/auth/host', undefined, { token });
    expect(replay.statusCode).toBe(401);
    expect(replay.json<{ title: string }>().title).toMatch(/already been used/);
  });

  it('counts sign-in tries for an account once across both copies', async () => {
    const email = `nobody-${randomUUID()}@example.com`;
    // One visitor address of its own, so no other sign-in in this file shares the count.
    const remoteAddress = `203.0.113.${1 + Math.floor(Math.random() * 250)}`;
    const tryOn = (h: Harness) =>
      h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress,
        payload: { email, password: 'Wrong-password-1' },
      });
    const statuses: number[] = [];
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ACCOUNT; i += 1)
      statuses.push((await tryOn(i % 2 ? b : a)).statusCode);
    expect(new Set(statuses)).toEqual(new Set([401]));
    expect((await tryOn(b)).statusCode).toBe(429);
    expect((await tryOn(a)).statusCode).toBe(429);
  });

  it('a setting saved on copy A is not served stale from the cache on copy B', async () => {
    const before = await b.container.configs.forWorkspace(DEFAULT_WORKSPACE_ID);
    const { settings } = (await call(a, 'GET', '/admin/assistant', adminOnA)).json<{
      settings: AssistantSettings;
    }>();
    const res = await call(a, 'PUT', '/admin/assistant/settings', adminOnA, {
      version: settings.version,
      chatEnabled: !before.chatEnabled,
    });
    expect(res.statusCode).toBe(200);
    const fresh = async () =>
      (await b.container.configs.forWorkspace(DEFAULT_WORKSPACE_ID)).chatEnabled;
    await until(async () => (await fresh()) !== before.chatEnabled);
    expect(await fresh()).toBe(!before.chatEnabled);
  });

  it('a draft change made on copy A reaches a call watching the draft on copy B', async () => {
    const heard: DraftChange[] = [];
    const draft: TicketDraft = {
      id: randomUUID(),
      category: null,
      bookId: null,
      subject: 'Royalty mismatch',
      description: '',
      status: 'OPEN',
      version: 2,
      lastEditedBy: 'AUTHOR',
      isComplete: false,
      ticket: null,
      updatedAt: new Date().toISOString(),
    };
    const stop = b.container.draftLive.subscribe(draft.id, (c) => heard.push(c));
    a.container.draftLive.publish({ draft, by: 'AUTHOR', changed: ['subject'] });
    await until(() => heard.length > 0);
    stop();
    expect(heard).toEqual([{ draft, by: 'AUTHOR', changed: ['subject'] }]);
  });
});
