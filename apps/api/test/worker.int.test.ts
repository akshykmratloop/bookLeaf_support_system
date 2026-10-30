import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { AiAuthError, AiUnavailableError } from '../src/ai/providers/errors.js';
import type { StructuredRequest } from '../src/ai/providers/types.js';
import {
  bookId,
  call,
  createHarness,
  createTicket,
  defaultHandler,
  EMAILS,
  type Harness,
} from './helpers/app.js';

let h: Harness;
let priya: string;
let admin: string;

const royaltyTicket = async () => {
  const res = await createTicket(h, priya, {
    bookId: await bookId(h, 'BK001'),
    subject: 'Royalty payout',
    description: 'My royalty payout has not arrived yet for my book, please check.',
  });
  return res.json<{ id: string }>().id;
};
/** Ordered TRIAGE then DRAFT (enum declaration order), then by generation. */
const jobsOf = (ticketId: string) =>
  h.db.aiJob.findMany({ where: { ticketId }, orderBy: [{ kind: 'asc' }, { generation: 'asc' }] });

/** Runs every due job, then jumps the clock past the longest backoff, until nothing is left for this ticket. */
async function settle(ticketId: string): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await h.drain();
    const open = await h.db.aiJob.count({
      where: { ticketId, status: { in: ['QUEUED', 'RUNNING'] } },
    });
    if (open === 0) return;
    h.clock.advance(130_000);
  }
  throw new Error('jobs did not settle');
}

beforeAll(async () => {
  h = await createHarness();
  [priya, admin] = await Promise.all([h.login(EMAILS.priya), h.login(EMAILS.admin)]);
  await h.drain();
});
afterEach(() => h.setAi(defaultHandler));
afterAll(() => h.close());

describe('AI pipeline with a working provider', () => {
  it('triage sets category and priority from AI, queues a draft, and the draft is stored with checks', async () => {
    const id = await royaltyTicket();
    await h.drain();
    const t = await h.db.ticket.findUniqueOrThrow({ where: { id } });
    expect(t).toMatchObject({
      categoryKey: 'ROYALTY_PAYMENTS',
      categorySource: 'AI',
      prioritySource: 'AI',
      aiState: 'DONE',
    });
    expect((await jobsOf(id)).map((j) => [j.kind, j.status])).toEqual([
      ['TRIAGE', 'SUCCEEDED'],
      ['DRAFT', 'SUCCEEDED'],
    ]);
    const draft = await call(h, 'GET', `/tickets/${id}/draft`, admin);
    const body = draft.json<{
      pending: boolean;
      draft: { source: string; facts: unknown[]; check: { passed: boolean } };
    }>();
    expect(body.pending).toBe(false);
    expect(body.draft.source).toBe('AI');
    expect(body.draft.facts.length).toBeGreaterThan(0);
    expect(body.draft.check.passed).toBe(true);
    expect(await h.db.aiRun.count({ where: { ticketId: id, outcome: 'OK' } })).toBe(2);
  });

  it('opening a ticket or its draft never calls the AI', async () => {
    const id = await royaltyTicket();
    await h.drain();
    const before = h.aiCalls.length;
    await call(h, 'GET', `/tickets/${id}`, admin);
    await call(h, 'GET', `/tickets/${id}/draft`, admin);
    expect(h.aiCalls.length).toBe(before);
  });

  it('never overwrites admin-set category or priority on a later AI triage', async () => {
    const id = await royaltyTicket();
    await h.drain();
    const view = await call(h, 'GET', `/tickets/${id}`, admin);
    const patched = await call(h, 'PATCH', `/tickets/${id}`, admin, {
      version: view.json<{ version: number }>().version,
      category: 'ISBN_METADATA',
      priority: 'LOW',
    });
    expect(patched.statusCode).toBe(200);
    h.setAi((req: StructuredRequest<unknown>) =>
      req.task === 'TRIAGE'
        ? {
            category: 'PRINTING_QUALITY',
            priority: 'CRITICAL',
            priorityReasons: ['x'],
            needsInfo: [],
            confidence: 'high',
          }
        : defaultHandler(req),
    );
    expect((await call(h, 'POST', `/tickets/${id}/ai/retry`, admin)).statusCode).toBe(202);
    await h.drain();
    const t = await h.db.ticket.findUniqueOrThrow({ where: { id } });
    expect(t).toMatchObject({
      categoryKey: 'ISBN_METADATA',
      categorySource: 'ADMIN',
      priority: 'LOW',
      prioritySource: 'ADMIN',
    });
  });
});

describe('AI failures degrade gracefully', () => {
  it('retries a transient error with backoff, then falls back to rules and a template draft', async () => {
    h.setAi(() => {
      throw new AiUnavailableError('provider down');
    });
    const id = await royaltyTicket();
    const startedAt = h.clock.now().getTime();
    await h.drain();
    const [triage] = await jobsOf(id);
    expect(triage).toMatchObject({
      kind: 'TRIAGE',
      status: 'QUEUED',
      attempts: 1,
      lastErrorCode: 'AI_UNAVAILABLE',
    });
    expect(triage?.runAfter.getTime()).toBeGreaterThan(startedAt);
    await settle(id);
    const jobs = await jobsOf(id);
    expect(jobs.map((j) => [j.kind, j.status, j.attempts])).toEqual([
      ['TRIAGE', 'FALLBACK', 3],
      ['DRAFT', 'FALLBACK', 3],
    ]);
    const t = await h.db.ticket.findUniqueOrThrow({ where: { id } });
    expect(t).toMatchObject({
      categoryKey: 'ROYALTY_PAYMENTS',
      categorySource: 'RULES',
      aiState: 'FALLBACK',
      needsReview: true,
    });
    const draft = await call(h, 'GET', `/tickets/${id}/draft`, admin);
    expect(draft.json<{ draft: { source: string; body: string } }>().draft.source).toBe('TEMPLATE');
    expect(await h.db.aiRun.count({ where: { ticketId: id, outcome: 'ERROR' } })).toBe(6);
  });

  it('falls back immediately on an authentication error (no retries)', async () => {
    h.setAi(() => {
      throw new AiAuthError('bad key');
    });
    const id = await royaltyTicket();
    await h.drain();
    const jobs = await jobsOf(id);
    expect(jobs.map((j) => [j.kind, j.status, j.attempts])).toEqual([
      ['TRIAGE', 'FALLBACK', 1],
      ['DRAFT', 'FALLBACK', 1],
    ]);
  });

  it('outage switch: tickets are still created, AI is not called, fallback applies', async () => {
    // The global outage switch is the super admin's (U-7, API covered in platform-ai.int.test.ts).
    await h.db.platformSettings.update({ where: { id: 1 }, data: { simulateOutage: true } });
    h.container.ai.invalidate();
    try {
      const before = h.aiCalls.length;
      const id = await royaltyTicket();
      await h.drain();
      expect(h.aiCalls.length).toBe(before);
      const t = await h.db.ticket.findUniqueOrThrow({ where: { id } });
      expect(t).toMatchObject({ aiState: 'FALLBACK', categorySource: 'RULES' });
      const reply = await call(h, 'POST', `/tickets/${id}/messages`, admin, {
        body: 'Hi Priya, thank you for your patience. Our team will get back to you within 48 hours. Warm regards, BookLeaf Author Support',
      });
      expect(reply.statusCode).toBe(201);
    } finally {
      await h.db.platformSettings.update({ where: { id: 1 }, data: { simulateOutage: false } });
      h.container.ai.invalidate();
    }
  });
});

describe('job safety', () => {
  it('reclaims a RUNNING job whose lease expired (crashed worker)', async () => {
    const id = await royaltyTicket();
    await h.db.aiJob.updateMany({
      where: { ticketId: id, kind: 'TRIAGE' },
      data: {
        status: 'RUNNING',
        attempts: 1,
        leaseExpiresAt: new Date(h.clock.now().getTime() - 1000),
      },
    });
    await h.drain();
    const [triage] = (await jobsOf(id)).filter((j) => j.kind === 'TRIAGE');
    expect(triage).toMatchObject({ status: 'SUCCEEDED', attempts: 2 });
    expect((await h.db.ticket.findUniqueOrThrow({ where: { id } })).aiState).toBe('DONE');
  });

  it('does not reclaim a RUNNING job whose lease is still valid', async () => {
    const id = await royaltyTicket();
    await h.db.aiJob.updateMany({
      where: { ticketId: id, kind: 'TRIAGE' },
      data: {
        status: 'RUNNING',
        attempts: 1,
        leaseExpiresAt: new Date(h.clock.now().getTime() + 60_000),
      },
    });
    await h.drain();
    const [triage] = await jobsOf(id);
    expect(triage).toMatchObject({ status: 'RUNNING', attempts: 1 });
    await h.db.aiJob.updateMany({ where: { ticketId: id }, data: { status: 'SUCCEEDED' } });
  });

  it('discards the result of an older draft job when a newer one exists', async () => {
    const id = await royaltyTicket();
    await h.drain();
    await call(h, 'POST', `/tickets/${id}/draft/regenerate`, admin);
    await call(h, 'POST', `/tickets/${id}/draft/regenerate`, admin);
    await h.drain();
    const drafts = await h.db.aiDraft.findMany({
      where: { ticketId: id },
      orderBy: { generation: 'asc' },
    });
    expect(drafts.map((d) => d.generation)).toEqual([1, 3]);
    const latest = await call(h, 'GET', `/tickets/${id}/draft`, admin);
    expect(latest.json<{ draft: { generation: number } }>().draft.generation).toBe(3);
  });

  it('a new author message queues a fresh draft and reopens a resolved ticket', async () => {
    const id = await royaltyTicket();
    await h.drain();
    const v = (await call(h, 'GET', `/tickets/${id}`, admin)).json<{ version: number }>().version;
    await call(h, 'PATCH', `/tickets/${id}`, admin, { version: v, status: 'RESOLVED' });
    const msg = await call(h, 'POST', `/tickets/${id}/messages`, priya, {
      body: 'Still not received, please check again.',
    });
    expect(msg.statusCode).toBe(201);
    expect(msg.json<{ status: string }>().status).toBe('OPEN');
    const drafts = (await jobsOf(id)).filter((j) => j.kind === 'DRAFT');
    expect(drafts.map((j) => j.generation)).toEqual([1, 2]);
  });
});

describe("the platform's models and the workspace's own tone (U-7)", () => {
  it('triages and drafts with the platform models and passes its tone notes as style only', async () => {
    const { settings } = (await call(h, 'GET', '/workspace/settings', admin)).json<{
      settings: { version: number };
    }>();
    const saved = await call(h, 'PUT', '/workspace/settings', admin, {
      version: settings.version,
      toneGuide: 'Thank the author for their patience.',
    });
    expect(saved.statusCode).toBe(200);
    await h.db.platformSettings.update({
      where: { id: 1 },
      data: { triageModel: 'claude-opus-5-5', draftModel: 'claude-haiku-5-5' },
    });
    h.container.ai.invalidate();
    const before = h.aiCalls.length;
    await settle(await royaltyTicket());
    await h.db.platformSettings.update({
      where: { id: 1 },
      data: { triageModel: 'claude-haiku-5-5', draftModel: 'claude-sonnet-5-5' },
    });
    h.container.ai.invalidate();
    const calls = h.aiCalls.slice(before);
    expect(calls.find((c) => c.task === 'TRIAGE')?.model).toBe('claude-opus-5-5');
    const draft = calls.find((c) => c.task === 'DRAFT');
    expect(draft?.model).toBe('claude-haiku-5-5');
    expect(draft?.dynamicSystem).toContain(
      '- Tone and brand voice: Thank the author for their patience.\n</style_settings>',
    );
    expect(draft?.stableSystem).not.toContain('patience');
    // Back to the platform's choices for any later file.
    await h.db.workspaceSettings.deleteMany({ where: { workspaceId: DEFAULT_WORKSPACE_ID } });
  });
});
