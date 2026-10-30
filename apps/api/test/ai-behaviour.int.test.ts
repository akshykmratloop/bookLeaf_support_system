import type { AddressInfo } from 'node:net';
import type { StartVoiceCall, WorkspaceSettingsStatus } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { call, createHarness, createTicket, EMAILS, ORIGIN, type Harness } from './helpers/app.js';

/**
 * U-7: what a customer sets in Workspace Settings → AI behaviour (tone, greeting, signature,
 * language, reply length and formality, topics to avoid) reaches the triage, draft, chat and
 * voice prompts. Validated at the boundary; the platform's safety rules stay in every prompt.
 */
let h: Harness;
let admin: string;
let priya: string;

const BEHAVIOUR = {
  toneGuide: 'Sound like a friendly bookshop owner.',
  greeting: 'Hello {name}, lovely to hear from you!',
  signature: 'Cheers,\nThe Leafy Team',
  replyLanguage: 'HINGLISH',
  replyLength: 'SHORT',
  formality: 'FRIENDLY',
  topicsToAvoid: ['film rights', 'competitor pricing'],
} as const;

async function saveSettings(patch: Record<string, unknown>) {
  const { settings } = (
    await call(h, 'GET', '/workspace/settings', admin)
  ).json<WorkspaceSettingsStatus>();
  return call(h, 'PUT', '/workspace/settings', admin, { version: settings.version, ...patch });
}

const promptOf = (task: string, from: number) => {
  const req = h.aiCalls.slice(from).find((c) => c.task === task);
  return req ? `${req.stableSystem}\n${req.dynamicSystem ?? ''}\n${req.user}` : '';
};

beforeAll(async () => {
  h = await createHarness();
  [admin, priya] = await Promise.all([h.login(EMAILS.admin), h.login(EMAILS.priya)]);
});
afterAll(() => h.close());

describe('AI behaviour settings: validation (U-7)', () => {
  it('saves every behaviour field and returns it', async () => {
    const res = await saveSettings(BEHAVIOUR);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ...BEHAVIOUR, topicsToAvoid: [...BEHAVIOUR.topicsToAvoid] });
  });

  it('refuses unknown choices, too many topics, and a non-https logo', async () => {
    expect((await saveSettings({ replyLanguage: 'KLINGON' })).statusCode).toBe(422);
    const topics = Array.from({ length: 11 }, (_, i) => `topic ${i}`);
    expect((await saveSettings({ topicsToAvoid: topics })).statusCode).toBe(422);
    expect((await saveSettings({ logoUrl: 'http://cdn.example/logo.png' })).statusCode).toBe(422);
    expect((await saveSettings({ greeting: 'x'.repeat(201) })).statusCode).toBe(422);
    const html = await saveSettings({ greeting: '<b>Hi</b> {name}' });
    expect(html.json<{ greeting: string }>().greeting).toBe('Hi {name}');
    await saveSettings({ greeting: BEHAVIOUR.greeting });
  });
});

describe('AI behaviour settings reach every prompt (U-7)', () => {
  it('triage and the reply draft use them; safety rules stay', async () => {
    // Jobs left queued by an earlier test file (other customers' tickets) run first, so the
    // prompts read below are this ticket's own.
    while ((await h.drain()) > 0);
    const before = h.aiCalls.length;
    const res = await createTicket(h, priya, {
      bookId: null,
      subject: 'Behaviour check',
      description: 'When will my royalty arrive?',
    });
    expect(res.statusCode).toBe(201);
    await h.drain();
    const triage = promptOf('TRIAGE', before);
    expect(triage).toContain('film rights');
    expect(triage).toContain('Hinglish');
    const draft = promptOf('DRAFT', before);
    for (const text of [
      'friendly bookshop owner',
      'Hello Priya, lovely to hear from you!',
      'The Leafy Team',
      'Hinglish',
      'competitor pricing',
    ])
      expect(draft).toContain(text);
    expect(draft).toMatch(/short/i);
    expect(draft).toContain('[CONFIRM:');
  });

  it('chat uses them', async () => {
    const { settings } = (await call(h, 'GET', '/admin/assistant', admin)).json<{
      settings: { version: number };
    }>();
    await call(h, 'PUT', '/admin/assistant/settings', admin, {
      version: settings.version,
      chatEnabled: true,
    });
    const session = await call(h, 'POST', '/chat/sessions', priya);
    const { id } = session.json<{ id: string }>();
    const before = h.aiCalls.length;
    const res = await call(h, 'POST', `/chat/sessions/${id}/messages`, priya, {
      body: 'Can you tell me something about the publishing process overall?',
    });
    expect(res.statusCode).toBeLessThan(300);
    const chat = promptOf('CHAT', before);
    for (const text of ['friendly bookshop owner', 'film rights', 'Hinglish'])
      expect(chat).toContain(text);
  });

  it('voice calls use them: the greeting, the language and the behaviour block', async () => {
    const { settings } = (await call(h, 'GET', '/admin/assistant', admin)).json<{
      settings: { version: number };
    }>();
    await call(h, 'PUT', '/admin/assistant/settings', admin, {
      version: settings.version,
      voiceEnabled: true,
    });
    await saveSettings({ replyLanguage: 'ENGLISH' });
    await h.app.listen({ port: 0, host: '127.0.0.1' });
    const base = `ws://127.0.0.1:${(h.app.server.address() as AddressInfo).port}`;
    const started = (await call(h, 'POST', '/voice/calls', priya)).json<StartVoiceCall>();
    const ws = new WebSocket(`${base}${started.socketPath}`, {
      headers: { cookie: priya, origin: ORIGIN },
    });
    ws.on('error', () => undefined);
    for (let i = 0; i < 100 && !h.voice?.config; i += 1)
      await new Promise((r) => setTimeout(r, 20));
    ws.close();
    const config = h.voice?.config;
    expect(config?.greeting).toBe('Hello Priya, lovely to hear from you!');
    expect(config?.instructions).toContain('film rights');
    expect(config?.instructions).toContain('friendly bookshop owner');
    expect(config?.instructions).toContain('Speak clear, simple Indian English');
    expect(config?.language).toBe('en');
  });
});
