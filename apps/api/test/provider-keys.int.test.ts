import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { call, createHarness, deleteWorkspace, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let acme: string;
let acmeId: string;

const OWNER = {
  workspaceName: 'Acme Keys',
  slug: 'acme-keys',
  ownerName: 'Ada Owner',
  email: 'ada@acme-keys.example',
  password: 'Correct-Horse-42',
};
const AI_KEY = 'sk-ant-acme-own-key-0000000000001234';
const VOICE_KEY = 'sk-proj-acme-voice-key-000000000005678';

const saveKey = (capability: string, body: object, cookie = acme) =>
  call(h, 'PUT', `/workspace/provider-keys/${capability}`, cookie, body);

beforeAll(async () => {
  h = await createHarness();
  await call(h, 'POST', '/signup', undefined, OWNER);
  acme = await h.login(OWNER.email, OWNER.password);
  acmeId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: OWNER.slug } })).id;
});
afterAll(async () => {
  await deleteWorkspace(h.db, OWNER.slug);
  await h.close();
});

describe("a workspace's own provider keys", () => {
  it('saves a key encrypted and only ever shows its last 4 characters', async () => {
    const empty = await call(h, 'GET', '/workspace/provider-keys', acme);
    expect(empty.json()).toMatchObject({
      items: [],
      providers: { AI: ['anthropic'], VOICE: ['openai'] },
      secretsConfigured: true,
    });
    const saved = await saveKey('AI', { provider: 'anthropic', apiKey: AI_KEY });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ capability: 'AI', provider: 'anthropic', last4: '1234' });
    const list = await call(h, 'GET', '/workspace/provider-keys', acme);
    expect(JSON.stringify(list.json())).not.toContain(AI_KEY.slice(0, -4));
    const row = await h.db.workspaceProviderKey.findFirstOrThrow({
      where: { workspaceId: acmeId },
    });
    expect(row.keyEnc).not.toContain(AI_KEY.slice(4, 20));
    const audit = await h.db.auditEvent.count({
      where: { workspaceId: acmeId, action: 'provider_key.saved' },
    });
    expect(audit).toBe(1);
  });

  it('refuses unknown providers and malformed keys (422), authors (403) and strangers (401)', async () => {
    const codes = await Promise.all([
      saveKey('AI', { provider: 'openai', apiKey: AI_KEY }),
      saveKey('AI', { provider: 'anthropic', apiKey: 'short' }),
      saveKey('AI', { provider: 'anthropic', apiKey: 'sk-ant has spaces in it 000000' }),
      saveKey('SPEECH', { provider: 'openai', apiKey: VOICE_KEY }),
    ]);
    expect(codes.map((r) => r.statusCode)).toEqual([422, 422, 422, 422]);
    const author = await h.login(EMAILS.kavita);
    expect((await call(h, 'GET', '/workspace/provider-keys', author)).statusCode).toBe(403);
    expect((await call(h, 'GET', '/workspace/provider-keys', undefined)).statusCode).toBe(401);
  });

  it("runs the workspace's AI on its own key while BookLeaf keeps the platform's", async () => {
    const platformCalls = h.aiCalls.length;
    const own = await h.container.ai.providerFor(acmeId, 'anthropic');
    await own?.ping('claude-haiku-5-5');
    expect(h.ownKeyUses).toContain(`ai:${AI_KEY}`);
    expect(h.aiCalls.length).toBe(platformCalls);
    const bookleaf = await h.container.ai.providerFor(DEFAULT_WORKSPACE_ID, 'anthropic');
    expect(bookleaf).not.toBe(own);
  });

  it('gives a voice client built from the workspace key, separate from the platform one', async () => {
    expect((await saveKey('VOICE', { provider: 'openai', apiKey: VOICE_KEY })).statusCode).toBe(
      200,
    );
    const voice = await h.container.keyed.voice(acmeId);
    expect(voice).not.toBeNull();
    expect(voice).not.toBe(h.voice);
    expect(h.ownKeyUses).toContain(`voice:${VOICE_KEY}`);
    expect(await h.container.keyed.voice(DEFAULT_WORKSPACE_ID)).toBe(h.voice);
  });

  it("never falls back to the platform's key when the workspace's key cannot be read", async () => {
    await h.db.workspaceProviderKey.updateMany({
      where: { workspaceId: acmeId, capability: 'AI' },
      data: { keyEnc: 'v1.k1.broken.broken.broken.broken' },
    });
    h.container.keyed.invalidate(acmeId);
    expect(await h.container.ai.providerFor(acmeId, 'anthropic')).toBeUndefined();
    const access = await h.container.assistant.chatAccess(acmeId);
    expect(access).toMatchObject({ ok: false, state: 'NOT_CONFIGURED' });
  });

  it("removes a key (204, then 404) and the workspace goes back to the platform's", async () => {
    expect((await call(h, 'DELETE', '/workspace/provider-keys/AI', acme)).statusCode).toBe(204);
    expect((await call(h, 'DELETE', '/workspace/provider-keys/AI', acme)).statusCode).toBe(404);
    const platform = await h.container.ai.providerFor(DEFAULT_WORKSPACE_ID, 'anthropic');
    expect(await h.container.ai.providerFor(acmeId, 'anthropic')).toBe(platform);
  });
});
