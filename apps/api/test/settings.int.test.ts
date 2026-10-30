import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { call, createHarness, deleteWorkspace, EMAILS, type Harness } from './helpers/app.js';

let h: Harness;
let admin: string;
let acme: string;

const OWNER = {
  workspaceName: 'Acme Lending',
  slug: 'acme-settings',
  ownerName: 'Ada Owner',
  email: 'ada@acme.example',
  password: 'Correct-Horse-42',
};

beforeAll(async () => {
  h = await createHarness();
  await call(h, 'POST', '/signup', undefined, OWNER);
  [admin, acme] = await Promise.all([h.login(EMAILS.admin), h.login(OWNER.email, OWNER.password)]);
});
afterAll(async () => {
  await deleteWorkspace(h.db, OWNER.slug);
  await h.close();
});

describe('customer-data fields', () => {
  it("BookLeaf's fields are seeded for the default workspace; a new workspace starts empty", async () => {
    const bl = await call(h, 'GET', '/workspace/fields', admin);
    const keys = bl.json<{ items: { key: string }[] }>().items.map((f) => f.key);
    expect(keys).toContain('author.total_pending');
    expect(keys).toContain('book.{id}.royalty_status');
    expect((await call(h, 'GET', '/workspace/fields', acme)).json()).toEqual({ items: [] });
  });

  it('creates, updates and deletes a field, refusing duplicates (409) and bad keys (422)', async () => {
    const created = await call(h, 'POST', '/workspace/fields', acme, {
      key: 'account.balance',
      label: 'Account balance',
      type: 'MONEY',
      description: 'Outstanding loan balance',
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();
    expect(created.json()).toMatchObject({ visibleToCustomer: true, allowedValues: [] });

    const dup = await call(h, 'POST', '/workspace/fields', acme, {
      key: 'account.balance',
      label: 'Again',
      type: 'MONEY',
    });
    expect(dup.statusCode).toBe(409);
    const bad = await call(h, 'POST', '/workspace/fields', acme, {
      key: 'Account Balance!',
      label: 'x',
      type: 'MONEY',
    });
    expect(bad.statusCode).toBe(422);
    const status = await call(h, 'POST', '/workspace/fields', acme, {
      key: 'loan.{id}.status',
      label: 'Loan status',
      type: 'STATUS',
    });
    expect(status.statusCode).toBe(422);

    const updated = await call(h, 'PUT', `/workspace/fields/${id}`, acme, {
      key: 'account.balance',
      label: 'Balance due',
      type: 'MONEY',
      visibleToCustomer: false,
    });
    expect(updated.json()).toMatchObject({ label: 'Balance due', visibleToCustomer: false });

    expect(
      (await call(h, 'PUT', `/workspace/fields/${id}`, admin, updated.json())).statusCode,
    ).toBe(404);
    expect((await call(h, 'DELETE', `/workspace/fields/${id}`, admin)).statusCode).toBe(404);
    expect((await call(h, 'DELETE', `/workspace/fields/${id}`, acme)).statusCode).toBe(204);
    expect((await call(h, 'GET', '/workspace/fields', acme)).json()).toEqual({ items: [] });
  });
});

describe('workspace settings', () => {
  it('starts on platform defaults with the allowed models, and saves changes with a version', async () => {
    const res = await call(h, 'GET', '/workspace/settings', acme);
    expect(res.statusCode).toBe(200);
    const status = res.json<{
      settings: { version: number; chatEnabled: boolean };
      models: unknown[];
    }>();
    expect(status.settings).toMatchObject({
      version: 0,
      chatEnabled: false,
      customerNoun: 'customer',
    });
    expect(status.models.length).toBeGreaterThan(0);

    const saved = await call(h, 'PUT', '/workspace/settings', acme, {
      version: 0,
      chatEnabled: true,
      customerNoun: 'borrower',
      itemNoun: 'loan',
      allowedOrigins: ['https://app.acme.example/some/path'],
      brandColor: '#112233',
      toneGuide: 'Warm and <b>plain</b>.',
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      version: 1,
      chatEnabled: true,
      customerNoun: 'borrower',
      allowedOrigins: ['https://app.acme.example'],
      toneGuide: 'Warm and plain.',
    });
  });

  it('refuses a stale version (409), an unknown model and out-of-range limits (422)', async () => {
    expect(
      (await call(h, 'PUT', '/workspace/settings', acme, { version: 0, chatEnabled: false }))
        .statusCode,
    ).toBe(409);
    const model = await call(h, 'PUT', '/workspace/settings', acme, {
      version: 1,
      chatModel: 'gpt-9',
    });
    expect(model.statusCode).toBe(422);
    expect(model.json<{ errors: { path: string }[] }>().errors[0]?.path).toBe('chatModel');
    expect(
      (await call(h, 'PUT', '/workspace/settings', acme, { version: 1, maxCallSeconds: 9999 }))
        .statusCode,
    ).toBe(422);
    expect(
      (await call(h, 'PUT', '/workspace/settings', acme, { version: 1, brandColor: 'red' }))
        .statusCode,
    ).toBe(422);
  });

  it('names the bad widget origin entry in a readable field error (422)', async () => {
    const res = await call(h, 'PUT', '/workspace/settings', acme, {
      version: 1,
      allowedOrigins: ['https://ok.example', 'javascript:alert(1)'],
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ errors: { path: string; message: string }[] }>().errors).toContainEqual({
      path: 'allowedOrigins.1',
      message: 'Use a page origin, like https://app.example.com',
    });
  });

  it("runs chat and voice on the workspace's own switches and limits, not another's", async () => {
    const acmeId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: OWNER.slug } })).id;
    const before = await h.container.assistant.config(DEFAULT_WORKSPACE_ID);
    const { settings } = (await call(h, 'GET', '/workspace/settings', acme)).json<{
      settings: { version: number };
    }>();
    const saved = await call(h, 'PUT', '/workspace/settings', acme, {
      version: settings.version,
      voiceEnabled: true,
      maxTurnsPerSession: 4,
      messagesPerMinute: 7,
      maxCallSeconds: 120,
    });
    expect(saved.statusCode).toBe(200);
    const mine = await h.container.assistant.config(acmeId);
    expect(mine).toMatchObject({ chatEnabled: true, voiceEnabled: true });
    expect(mine.limits.chat).toMatchObject({ maxTurnsPerSession: 4, messagesPerMinute: 7 });
    expect(mine.limits.voice.maxCallSeconds).toBe(120);
    expect(await h.container.assistant.config(DEFAULT_WORKSPACE_ID)).toEqual(before);
  });

  it("offers the voice provider's voices and refuses one it does not have (422)", async () => {
    const res = await call(h, 'GET', '/workspace/settings', acme);
    const status = res.json<{ voices: string[]; settings: { version: number } }>();
    expect(status.voices).toContain('marin');
    const { version } = status.settings;
    const bad = await call(h, 'PUT', '/workspace/settings', acme, { version, voiceName: 'robot' });
    expect(bad.statusCode).toBe(422);
    expect(bad.json<{ errors: { path: string }[] }>().errors[0]?.path).toBe('voiceName');
    const ok = await call(h, 'PUT', '/workspace/settings', acme, { version, voiceName: 'cedar' });
    expect(ok.json()).toMatchObject({ voiceName: 'cedar' });
  });

  it("shows customers the workspace's own brand; BookLeaf keeps its name and coral", async () => {
    const acmeId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: OWNER.slug } })).id;
    expect((await h.container.assistant.availability(acmeId)).brand).toEqual({
      name: 'Acme Lending',
      color: '#112233',
    });
    const { settings } = (await call(h, 'GET', '/workspace/settings', acme)).json<{
      settings: { version: number };
    }>();
    await call(h, 'PUT', '/workspace/settings', acme, {
      version: settings.version,
      brandName: 'Acme',
    });
    expect((await h.container.assistant.availability(acmeId)).brand.name).toBe('Acme');
    expect((await h.container.assistant.availability(DEFAULT_WORKSPACE_ID)).brand).toEqual({
      name: 'BookLeaf',
      color: '#d13f53',
    });
  });

  it("never shows one workspace's settings to another, and keeps authors out (403)", async () => {
    const bl = await call(h, 'GET', '/workspace/settings', admin);
    expect(bl.json<{ settings: { customerNoun: string } }>().settings.customerNoun).toBe(
      'customer',
    );
    const kavita = await h.login(EMAILS.kavita);
    expect((await call(h, 'GET', '/workspace/settings', kavita)).statusCode).toBe(403);
    expect((await call(h, 'GET', '/workspace/fields', kavita)).statusCode).toBe(403);
  });
});

describe('workspace API keys', () => {
  it('creates a key shown once, lists it by prefix only, verifies it, and revokes it', async () => {
    const created = await call(h, 'POST', '/workspace/api-keys', acme, {
      name: 'Production server',
      scopes: ['customers:read', 'tickets:read'],
    });
    expect(created.statusCode).toBe(201);
    const { key, plainKey } = created.json<{
      key: { id: string; prefix: string };
      plainKey: string;
    }>();
    expect(plainKey.startsWith(key.prefix)).toBe(true);
    expect(plainKey.length).toBeGreaterThan(40);

    const list = await call(h, 'GET', '/workspace/api-keys', acme);
    expect(JSON.stringify(list.json())).not.toContain(plainKey);
    expect(list.json<{ items: { prefix: string }[] }>().items[0]?.prefix).toBe(key.prefix);
    const row = await h.db.workspaceApiKey.findUniqueOrThrow({ where: { id: key.id } });
    expect(row.keyHash).not.toContain(plainKey.slice(-10));

    const verified = await h.container.workspaces.apiKeys.verify(plainKey);
    expect(verified?.scopes).toEqual(['customers:read', 'tickets:read']);
    expect(await h.container.workspaces.apiKeys.verify('blsk_nope_nope')).toBeNull();

    expect((await call(h, 'DELETE', `/workspace/api-keys/${key.id}`, admin)).statusCode).toBe(404);
    const revoked = await call(h, 'DELETE', `/workspace/api-keys/${key.id}`, acme);
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json<{ revokedAt: string | null }>().revokedAt).not.toBeNull();
    expect(await h.container.workspaces.apiKeys.verify(plainKey)).toBeNull();
  });
});
