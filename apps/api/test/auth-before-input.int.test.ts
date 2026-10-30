import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, EMAILS, type Harness } from './helpers/app.js';
import { platformLogin, seedSuperAdmin } from './helpers/platform.js';

/**
 * Who you are is checked before what you sent: a caller without a valid session or key gets
 * 401/403, never a validation error that describes the route's input.
 */
let h: Harness;
let admin: string;
let author: string;

beforeAll(async () => {
  h = await createHarness();
  await seedSuperAdmin(h);
  [admin, author] = await Promise.all([h.login(EMAILS.admin), h.login(EMAILS.priya)]);
});
afterAll(() => h.close());

const bad = { nonsense: true };
const ID = '00000000-0000-4000-8000-000000000000';

describe('sign-in is checked before the input', () => {
  it.each([
    ['PUT', '/admin/assistant/settings'],
    ['POST', `/chat/sessions/${ID}/messages`],
    ['PATCH', `/tickets/${ID}`],
    ['PUT', '/workspace/settings'],
  ] as const)('anonymous %s %s with a bad body gets 401', async (method, url) => {
    const res = await call(h, method, url, undefined, bad);
    expect(res.statusCode).toBe(401);
  });

  it('an author on a staff route with a bad body gets 403', async () => {
    const res = await call(h, 'PUT', '/admin/assistant/settings', author, bad);
    expect(res.statusCode).toBe(403);
  });

  it('a signed-in staff member with a bad body still gets the validation error', async () => {
    const res = await call(h, 'PATCH', `/tickets/${ID}`, admin, bad);
    expect(res.statusCode).toBe(422);
  });
});

describe('the super admin console checks its session before the input', () => {
  it.each([
    ['PUT', '/platform/ai/settings'],
    ['PUT', `/platform/customers/${ID}/plan`],
  ] as const)('anonymous %s %s with a bad body gets 401', async (method, url) => {
    const res = await call(h, method, url, undefined, bad);
    expect(res.statusCode).toBe(401);
  });

  it('a customer session gets 403 before the input is read', async () => {
    const res = await call(h, 'PUT', '/platform/ai/settings', admin, bad);
    expect(res.statusCode).toBe(403);
  });

  it('a super admin with a bad body still gets the validation error', async () => {
    const cookie = await platformLogin(h);
    const res = await call(h, 'PUT', '/platform/ai/settings', cookie, bad);
    expect(res.statusCode).toBe(422);
  });
});

describe('the server API checks the key before the input', () => {
  it.each([
    ['POST', '/server/tickets'],
    ['PATCH', `/server/tickets/${ID}`],
    ['POST', `/server/tickets/${ID}/messages`],
  ] as const)('%s %s without a key gets 401', async (method, url) => {
    const res = await call(h, method, url, undefined, bad);
    expect(res.statusCode).toBe(401);
  });

  it('a wrong key with a bad body gets 401', async () => {
    const res = await call(h, 'POST', '/server/tickets', undefined, bad, {
      authorization: 'Bearer blsk_not-a-real-key-000000000000000000000',
    });
    expect(res.statusCode).toBe(401);
  });
});
