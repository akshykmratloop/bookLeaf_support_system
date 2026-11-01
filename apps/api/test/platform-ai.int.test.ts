import type { PlatformAiStatus } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  call,
  createHarness,
  createTicket,
  EMAILS,
  SENTINEL_KEY,
  type Harness,
} from './helpers/app.js';
import { platformCookie, seedSuperAdmin } from './helpers/platform.js';

/**
 * U-7: providers, keys, models and the outage switch are platform settings. Every customer runs
 * on them; customers cannot see or change them.
 */
let h: Harness;
let platform: string;
let priya: string;

const status = async () =>
  (await call(h, 'GET', '/platform/ai', platform)).json<PlatformAiStatus>();

async function savePlatformAi(patch: Record<string, unknown>) {
  const { settings } = await status();
  return call(h, 'PUT', '/platform/ai/settings', platform, { version: settings.version, ...patch });
}

async function triageModelOfNewTicket(subject: string): Promise<string | undefined> {
  const before = h.aiCalls.length;
  const res = await createTicket(h, priya, {
    bookId: null,
    subject,
    description: `${subject}: when will my royalty for the last quarter arrive?`,
  });
  expect(res.statusCode).toBe(201);
  await h.drain();
  return h.aiCalls.slice(before).find((c) => c.task === 'TRIAGE')?.model;
}

beforeAll(async () => {
  h = await createHarness();
  await seedSuperAdmin(h);
  platform = await platformCookie(h);
  priya = await h.login(EMAILS.priya);
});
afterAll(async () => {
  await h.db.platformProviderKey.deleteMany();
  await h.close();
});

describe('platform AI settings (U-7)', () => {
  it('starts from the old shared settings, with the env key as the source', async () => {
    const s = await status();
    expect(s.settings).toMatchObject({
      provider: 'anthropic',
      triageModel: 'claude-haiku-5-5',
      draftModel: 'claude-sonnet-5-5',
      chatModel: 'claude-haiku-5-5',
      voiceModel: null,
      simulateOutage: false,
    });
    const anthropic = s.providers.find((p) => p.capability === 'AI' && p.id === 'anthropic');
    expect(anthropic).toMatchObject({ keySource: 'ENV', last4: null });
    expect(JSON.stringify(s)).not.toContain(SENTINEL_KEY);
  });

  it('lists the voice models so the console can offer a dropdown, not a free-text box', async () => {
    const s = await status();
    const voice = s.providers.find((p) => p.capability === 'VOICE' && p.id === 'openai');
    const ids = voice?.models.map((m) => m.id) ?? [];
    expect(ids).toEqual(expect.arrayContaining(['gpt-realtime', 'gpt-realtime-mini']));
    expect(ids).toContain(s.defaultVoiceModel);
  });

  it('chooses the models every customer runs on (allowlist, version-checked)', async () => {
    const bad = await savePlatformAi({ triageModel: 'gpt-9' });
    expect(bad.statusCode).toBe(422);
    const ok = await savePlatformAi({ triageModel: 'claude-sonnet-5-5' });
    expect(ok.statusCode).toBe(200);
    const stale = await call(h, 'PUT', '/platform/ai/settings', platform, {
      version: 0,
      triageModel: 'claude-haiku-5-5',
    });
    expect(stale.statusCode).toBe(409);
    expect(await triageModelOfNewTicket('Model check one')).toBe('claude-sonnet-5-5');
    await savePlatformAi({ triageModel: 'claude-haiku-5-5' });
  });

  it('the global outage switch turns AI off for every customer (rules fallback)', async () => {
    await savePlatformAi({ simulateOutage: true });
    try {
      const av = (await call(h, 'GET', '/assistant/availability', priya)).json<{
        chat: { state: string };
      }>();
      expect(['AI_OUTAGE', 'DISABLED']).toContain(av.chat.state);
      expect(await triageModelOfNewTicket('Outage check')).toBeUndefined();
      const t = await h.db.ticket.findFirstOrThrow({ where: { subject: 'Outage check' } });
      expect(t.aiState).toBe('FALLBACK');
    } finally {
      await savePlatformAi({ simulateOutage: false });
    }
  });
});

describe('platform provider keys (U-7)', () => {
  const KEY = 'sk-ant-PLATFORM-SAVED-KEY-1234';

  it('saves a key encrypted, shows only its last 4, and uses it instead of the env key', async () => {
    const saved = await call(h, 'PUT', '/platform/ai/keys/AI/anthropic', platform, { apiKey: KEY });
    expect(saved.statusCode).toBe(200);
    expect(JSON.stringify(saved.json())).not.toContain(KEY);
    const row = await h.db.platformProviderKey.findFirstOrThrow({
      where: { provider: 'anthropic' },
    });
    expect(row.keyEnc).not.toContain(KEY);
    const s = await status();
    expect(s.providers.find((p) => p.id === 'anthropic')).toMatchObject({
      keySource: 'SAVED',
      last4: '1234',
    });
    await triageModelOfNewTicket('Saved key check');
    expect(h.ownKeyUses).toContain(`ai:${KEY}`);
  });

  it('tests the connection with the active key, and removing the key falls back to env', async () => {
    const test = await call(h, 'POST', '/platform/ai/test', platform);
    // Both keys: the AI (text) key and the voice key, each with its own result.
    expect(test.json()).toMatchObject({ ai: { ok: true }, voice: { ok: true } });
    // Kept in the database, so every copy of the API (and a restarted one) shows it.
    const row = await h.db.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row).toMatchObject({ lastTestOk: true, lastVoiceTestOk: true });
    const s0 = await status();
    expect(s0.lastTest).toMatchObject({ ok: true });
    expect(s0.lastVoiceTest).toMatchObject({ ok: true, detail: 'fake-realtime connected' });
    expect((await call(h, 'DELETE', '/platform/ai/keys/AI/anthropic', platform)).statusCode).toBe(
      204,
    );
    expect((await call(h, 'DELETE', '/platform/ai/keys/AI/anthropic', platform)).statusCode).toBe(
      404,
    );
    const s = await status();
    expect(s.providers.find((p) => p.id === 'anthropic')?.keySource).toBe('ENV');
  });

  it('shows a refused voice key as a failed voice test, without failing the AI test', async () => {
    if (!h.voice) throw new Error('the harness runs with the fake voice provider');
    h.voice.failNextConnect = 'VOICE_AUTH';
    const test = await call(h, 'POST', '/platform/ai/test', platform);
    expect(test.json()).toMatchObject({
      ai: { ok: true },
      voice: { ok: false, detail: 'Failed: VOICE_AUTH' },
    });
    expect((await status()).lastVoiceTest).toMatchObject({ ok: false });
  });

  it('refuses unknown providers and keys that look wrong', async () => {
    const unknown = await call(h, 'PUT', '/platform/ai/keys/AI/acme-llm', platform, {
      apiKey: KEY,
    });
    expect(unknown.statusCode).toBe(422);
    const short = await call(h, 'PUT', '/platform/ai/keys/AI/anthropic', platform, {
      apiKey: 'short',
    });
    expect(short.statusCode).toBe(422);
  });
});
