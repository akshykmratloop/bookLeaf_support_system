import type { WorkspaceSettingsStatus } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';

/**
 * U-7: providers, models, keys and the outage switch belong to the support provider. Customer
 * staff (BookLeaf's included) get 403 "Managed by your support provider" from the server, not
 * just a hidden screen.
 */
let h: Harness;
let admin: string;

const MANAGED = 'Managed by your support provider';

beforeAll(async () => {
  h = await createHarness();
  admin = await h.login(EMAILS.admin);
});
afterAll(() => h.close());

const expectManaged = (res: { statusCode: number; body: string }) => {
  expect(res.statusCode).toBe(403);
  expect(res.body).toContain(MANAGED);
};

describe('settings managed by the support provider (U-7)', () => {
  it('the old AI Settings API answers 403 for every customer admin', async () => {
    expectManaged(await call(h, 'GET', '/admin/ai/status', admin));
    expectManaged(await call(h, 'GET', '/admin/ai/settings', admin));
    expectManaged(
      await call(h, 'PUT', '/admin/ai/settings', admin, { version: 0, simulateOutage: true }),
    );
    expectManaged(await call(h, 'POST', '/admin/ai/test', admin));
  });

  it('customers cannot bring their own provider keys any more', async () => {
    expectManaged(await call(h, 'GET', '/workspace/provider-keys', admin));
    expectManaged(
      await call(h, 'PUT', '/workspace/provider-keys/AI', admin, {
        provider: 'anthropic',
        apiKey: 'sk-ant-customer-key-123456789',
      }),
    );
    expectManaged(await call(h, 'DELETE', '/workspace/provider-keys/AI', admin));
  });

  it('model choices in workspace and assistant settings are refused with 403', async () => {
    const { settings } = (
      await call(h, 'GET', '/workspace/settings', admin)
    ).json<WorkspaceSettingsStatus>();
    expect(settings).not.toHaveProperty('triageModel');
    expectManaged(
      await call(h, 'PUT', '/workspace/settings', admin, {
        version: settings.version,
        triageModel: 'claude-opus-5-5',
      }),
    );
    expectManaged(
      await call(h, 'PUT', '/admin/assistant/settings', admin, {
        version: settings.version,
        chatModel: 'claude-opus-5-5',
      }),
    );
  });

  it('an author gets 403 too, and no session gets 401', async () => {
    const priya = await h.login(EMAILS.priya);
    expect((await call(h, 'GET', '/admin/ai/status', priya)).statusCode).toBe(403);
    expect((await call(h, 'GET', '/admin/ai/status', undefined)).statusCode).toBe(401);
  });
});
