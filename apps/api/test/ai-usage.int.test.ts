import { AiUsageSchema, type AiUsage } from '@bookleaf/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { recordRun } from '../src/ai/jobs/runs.js';
import { call, createHarness, deleteWorkspace, EMAILS, type Harness } from './helpers/app.js';
import { platformCookie, seedSuperAdmin } from './helpers/platform.js';
import { authorCookieOf, ownerCookie, ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * AI usage for admins (cost-consciousness): each workspace admin sees only its own AI cost per
 * feature, and the super admin sees the same report for any customer. Counts and cost only.
 */
let h: Harness;
const A = 'usage-acme';
const B = 'usage-bravo';
let aId = '';
let bId = '';
let adminA = '';
let adminB = '';
let authorA = '';
let platform = '';

const DAY_MS = 86_400_000;
const ago = (days: number) => new Date(h.clock.now().getTime() - days * DAY_MS);

interface Run {
  task: string;
  costMicros: number;
  outcome?: 'OK' | 'ERROR';
  createdAt?: Date;
}
const run = (workspaceId: string, r: Run) => ({
  workspaceId,
  task: r.task,
  provider: 'anthropic',
  model: 'claude-haiku-5-5',
  costMicros: r.costMicros,
  latencyMs: 100,
  outcome: r.outcome ?? 'OK',
  createdAt: r.createdAt ?? ago(1),
});

async function seedUsage() {
  await h.db.aiRun.createMany({
    data: [
      run(aId, { task: 'TRIAGE', costMicros: 300 }),
      run(aId, { task: 'TRIAGE', costMicros: 300 }),
      run(aId, { task: 'TRIAGE', costMicros: 0, outcome: 'ERROR' }),
      run(aId, { task: 'DRAFT', costMicros: 4_000 }),
      run(aId, { task: 'CHAT', costMicros: 100 }),
      run(aId, { task: 'CHAT', costMicros: 100 }),
      run(aId, { task: 'CHAT', costMicros: 100 }),
      run(aId, { task: 'VOICE', costMicros: 90_000 }),
      // Not the customer's usage: a connection test, and a run older than the 30-day window.
      run(aId, { task: 'TEST', costMicros: 5_000 }),
      run(aId, { task: 'TRIAGE', costMicros: 1_000_000, createdAt: ago(40) }),
      run(bId, { task: 'CHAT', costMicros: 50 }),
    ],
  });
  const author = await h.db.author.findFirstOrThrow({ where: { workspaceId: aId } });
  await h.db.voiceSession.create({
    data: {
      workspaceId: aId,
      authorId: author.id,
      status: 'ENDED',
      provider: 'openai',
      model: 'gpt-realtime-2.1',
      maxSeconds: 300,
      durationSeconds: 90,
    },
  });
}

const usageOf = async (url: string, cookie: string) => {
  const res = await call(h, 'GET', url, cookie);
  expect(res.statusCode).toBe(200);
  return AiUsageSchema.parse(res.json());
};

async function cleanUp() {
  const ids = (await h.db.workspace.findMany({ where: { slug: { in: [A, B] } } })).map((w) => w.id);
  await h.db.aiRun.deleteMany({ where: { workspaceId: { in: ids } } });
  await deleteWorkspace(h.db, A);
  await deleteWorkspace(h.db, B);
}

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '50' } });
  await cleanUp();
  await seedSuperAdmin(h);
  platform = await platformCookie(h);
  await signupWorkspace(h, ownerOf(A, 'Usage Acme'));
  await signupWorkspace(h, ownerOf(B, 'Usage Bravo'));
  aId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: A } })).id;
  bId = (await h.db.workspace.findUniqueOrThrow({ where: { slug: B } })).id;
  adminA = await ownerCookie(h, A);
  adminB = await ownerCookie(h, B);
  authorA = await authorCookieOf(h, A);
  await seedUsage();
});
afterAll(async () => {
  await cleanUp();
  await h.close();
});

const EXPECTED_A: Omit<AiUsage, 'since'> = {
  days: 30,
  totalCostMicros: 600 + 4_000 + 300 + 90_000,
  totalCredits: 94.9,
  features: [
    { feature: 'TRIAGE', unit: 'ticket', units: 2, costMicros: 600, costPerUnitMicros: 300 },
    { feature: 'DRAFT', unit: 'draft', units: 1, costMicros: 4_000, costPerUnitMicros: 4_000 },
    { feature: 'CHAT', unit: 'reply', units: 3, costMicros: 300, costPerUnitMicros: 100 },
    { feature: 'VOICE', unit: 'minute', units: 1.5, costMicros: 90_000, costPerUnitMicros: 60_000 },
  ],
  perTicketMicros: 2_300,
};

describe('GET /workspace/usage', () => {
  it('shows the workspace admin its last 30 days of AI cost per feature', async () => {
    const usage = await usageOf('/workspace/usage', adminA);
    expect(usage).toMatchObject(EXPECTED_A);
    const since = new Date(usage.since).getTime();
    expect(Math.abs(since - ago(30).getTime())).toBeLessThan(60_000);
  });

  it('never shows another workspace’s usage (B sees only its own one reply)', async () => {
    const usage = await usageOf('/workspace/usage', adminB);
    expect(usage.totalCostMicros).toBe(50);
    expect(usage.features.find((f) => f.feature === 'CHAT')).toMatchObject({ units: 1 });
    expect(usage.features.find((f) => f.feature === 'VOICE')).toMatchObject({ units: 0 });
  });

  it('needs a signed-in staff admin: 401 without a session, 403 for an author', async () => {
    expect((await call(h, 'GET', '/workspace/usage')).statusCode).toBe(401);
    expect((await call(h, 'GET', '/workspace/usage', authorA)).statusCode).toBe(403);
    // The console's cookie is not a customer session: super admins are sent to the console.
    expect((await call(h, 'GET', '/workspace/usage', platform)).statusCode).toBe(403);
  });

  it('the default workspace’s admin sees its own figures, not the test companies’', async () => {
    const neha = await h.login(EMAILS.admin);
    const usage = await usageOf('/workspace/usage', neha);
    expect(usage.totalCostMicros).not.toBe(EXPECTED_A.totalCostMicros);
  });
});

describe('GET /platform/customers/:id/usage', () => {
  it('shows the super admin the same report the customer’s admin sees', async () => {
    const usage = await usageOf(`/platform/customers/${aId}/usage`, platform);
    expect(usage).toMatchObject(EXPECTED_A);
    expect((await usageOf(`/platform/customers/${bId}/usage`, platform)).totalCostMicros).toBe(50);
  });

  it('is the console’s only: 401 without a session, 403 for a customer admin', async () => {
    expect((await call(h, 'GET', `/platform/customers/${aId}/usage`)).statusCode).toBe(401);
    expect((await call(h, 'GET', `/platform/customers/${aId}/usage`, adminA)).statusCode).toBe(403);
  });

  it('404 for an unknown customer, 422 for an id that is not one', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const res = await call(h, 'GET', `/platform/customers/${missing}/usage`, platform);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ status: 404 });
    const bad = await call(h, 'GET', '/platform/customers/not-a-uuid/usage', platform);
    expect(bad.statusCode).toBe(422);
  });
});

describe('the run log keeps a cost the caller already knows', () => {
  it('a precomputed cost wins over the price-list estimate', async () => {
    await recordRun(h.db, {
      ticketId: null,
      workspaceId: bId,
      task: 'TEST',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      promptVersion: null,
      usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      costMicros: 7,
      latencyMs: 1,
      errorCode: null,
    });
    const saved = await h.db.aiRun.findFirstOrThrow({ where: { workspaceId: bId, task: 'TEST' } });
    expect(saved.costMicros).toBe(7);
  });
});
