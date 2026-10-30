import type { CustomerList, WorkspaceSettingsStatus } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import {
  call,
  createHarness,
  createTicket,
  deleteWorkspace,
  EMAILS,
  type Harness,
} from './helpers/app.js';
import { platformCookie, seedSuperAdmin, updatePlan } from './helpers/platform.js';
import { ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * U-7: the super admin's customer list (counts and usage only, never ticket content), suspending
 * customers, and plans that cap what a customer may switch on and set. Customers join only by
 * self-serve signup; the console cannot create them.
 */
let h: Harness;
let platform: string;
let priya: string;
const SLUG = 'plan-acme';
let acmeId = '';
let acme = '';

const settingsOf = async (cookie: string) =>
  (await call(h, 'GET', '/workspace/settings', cookie)).json<WorkspaceSettingsStatus>();

async function saveSettings(cookie: string, patch: Record<string, unknown>) {
  const { settings } = await settingsOf(cookie);
  return call(h, 'PUT', '/workspace/settings', cookie, { version: settings.version, ...patch });
}

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '50' } });
  await deleteWorkspace(h.db, SLUG);
  await seedSuperAdmin(h);
  platform = await platformCookie(h);
  priya = await h.login(EMAILS.priya);
  await signupWorkspace(h, ownerOf(SLUG, 'Plan Acme'));
  acmeId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: SLUG } })).id;
  acme = await ownerCookie(h, SLUG);
});
afterAll(async () => {
  await deleteWorkspace(h.db, SLUG);
  await h.close();
});

describe('customers list (U-7)', () => {
  it('shows each customer with counts, usage and AI cost, and no ticket content', async () => {
    const subject = 'Secret royalty subject for the list check';
    await createTicket(h, priya, {
      bookId: null,
      subject,
      description: 'private words here about my royalty payment',
    });
    await h.drain();
    const res = await call(h, 'GET', '/platform/customers', platform);
    expect(res.statusCode).toBe(200);
    const list = res.json<CustomerList>();
    const bookleaf = list.items.find((c) => c.id === DEFAULT_WORKSPACE_ID);
    expect(bookleaf?.usage.tickets).toBeGreaterThan(0);
    expect(bookleaf?.usage.aiRuns).toBeGreaterThan(0);
    expect(bookleaf?.usage.aiCostMicros).toBeGreaterThan(0);
    expect(list.items.find((c) => c.id === acmeId)).toMatchObject({
      slug: SLUG,
      suspended: false,
      staff: 1,
      // A new signup starts with the paid features off until the super admin approves it.
      plan: { chatAllowed: false, voiceAllowed: false, aiEnabled: false },
    });
    expect(res.body).not.toContain(subject);
    expect(res.body).not.toContain('private words here');
    expect(res.body).not.toContain(EMAILS.priya);
  });

  it('has no way to create a customer: companies join only by self-serve signup', async () => {
    const res = await call(h, 'POST', '/platform/customers', platform, ownerOf('plan-nope', 'No'));
    expect(res.statusCode).toBe(404);
    expect(await h.db.workspace.findUnique({ where: { slug: 'plan-nope' } })).toBeNull();
    expect((await call(h, 'GET', '/workspace', acme)).statusCode).toBe(200);
  });
});

describe('plans cap what a customer may use (U-7)', () => {
  it('a feature the plan does not allow cannot be switched on (403) and is off for authors', async () => {
    const approve = { chatAllowed: true, voiceAllowed: true, aiEnabled: true };
    expect((await updatePlan(h, platform, acmeId, approve)).statusCode).toBe(200);
    expect((await saveSettings(acme, { chatEnabled: true })).statusCode).toBe(200);
    expect((await updatePlan(h, platform, acmeId, { chatAllowed: false })).statusCode).toBe(200);
    expect((await saveSettings(acme, { chatEnabled: true })).statusCode).toBe(403);
    const s = await settingsOf(acme);
    expect(s.plan.chatAllowed).toBe(false);
    const res = await call(h, 'PUT', '/admin/assistant/settings', acme, {
      version: s.settings.version,
      chatEnabled: true,
    });
    expect(res.statusCode).toBe(403);
    const config = await h.container.configs.forWorkspace(acmeId);
    expect(config.chatEnabled).toBe(false);
    await updatePlan(h, platform, acmeId, { chatAllowed: true });
  });

  it('limits above the plan maximum are refused (422) and saved ones are capped', async () => {
    expect((await saveSettings(acme, { messagesPerMinute: 60 })).statusCode).toBe(200);
    const lowered = await updatePlan(h, platform, acmeId, { max: { messagesPerMinute: 10 } });
    expect(lowered.statusCode).toBe(200);
    const over = await saveSettings(acme, { messagesPerMinute: 11 });
    expect(over.statusCode).toBe(422);
    expect(over.body).toContain('at most 10');
    expect((await saveSettings(acme, { messagesPerMinute: 10 })).statusCode).toBe(200);
    await h.db.workspaceSettings.update({
      where: { workspaceId: acmeId },
      data: { messagesPerMinute: 60 },
    });
    h.container.configs.invalidate(acmeId);
    const config = await h.container.configs.forWorkspace(acmeId);
    expect(config.limits.chat.messagesPerMinute).toBe(10);
  });

  it('refuses a stale plan version (409) and a value outside the allowed range (422)', async () => {
    const stale = await call(h, 'PUT', `/platform/customers/${acmeId}/plan`, platform, {
      version: 0,
      voiceAllowed: false,
    });
    expect(stale.statusCode).toBe(409);
    const tooBig = await updatePlan(h, platform, acmeId, { max: { callsPerHour: 9999 } });
    expect(tooBig.statusCode).toBe(422);
    const missing = await call(
      h,
      'PUT',
      `/platform/customers/${'0'.repeat(8)}-0000-4000-8000-000000000000/plan`,
      platform,
      { version: 0 },
    );
    expect(missing.statusCode).toBe(404);
  });

  it('AI off for one customer: its tickets use the rules, other customers keep AI', async () => {
    await updatePlan(h, platform, DEFAULT_WORKSPACE_ID, { aiEnabled: false });
    try {
      const before = h.aiCalls.length;
      await createTicket(h, priya, {
        bookId: null,
        subject: 'AI off check',
        description: 'Where is my royalty payment for this quarter?',
      });
      await h.drain();
      expect(h.aiCalls.slice(before).filter((c) => c.task === 'TRIAGE')).toHaveLength(0);
      const t = await h.db.ticket.findFirstOrThrow({ where: { subject: 'AI off check' } });
      expect(t.aiState).toBe('FALLBACK');
    } finally {
      await updatePlan(h, platform, DEFAULT_WORKSPACE_ID, { aiEnabled: true });
    }
    const before = h.aiCalls.length;
    await createTicket(h, priya, {
      bookId: null,
      subject: 'AI back on',
      description: 'Royalty question again, still waiting for it.',
    });
    await h.drain();
    expect(h.aiCalls.slice(before).some((c) => c.task === 'TRIAGE')).toBe(true);
  });
});

describe('suspending a customer (U-7)', () => {
  it('refuses its staff sign-in and existing sessions until it is lifted', async () => {
    expect((await updatePlan(h, platform, acmeId, { suspended: true })).statusCode).toBe(200);
    const login = await call(h, 'POST', '/auth/login', undefined, {
      email: `owner@${SLUG}.example`,
      password: ownerOf(SLUG, '').password,
    });
    expect(login.statusCode).toBe(403);
    expect((await call(h, 'GET', '/workspace', acme)).statusCode).toBe(403);
    const list = (await call(h, 'GET', '/platform/customers', platform)).json<CustomerList>();
    expect(list.items.find((c) => c.id === acmeId)?.suspended).toBe(true);
    expect((await call(h, 'GET', '/tickets', priya)).statusCode).toBe(200);
    await updatePlan(h, platform, acmeId, { suspended: false });
    expect((await call(h, 'GET', '/workspace', acme)).statusCode).toBe(200);
  });
});
