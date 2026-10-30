import { describe, expect, it } from 'vitest';
import type { OnboardingStep, OnboardingStepId } from '@bookleaf/shared';
import type { OnboardingFacts } from './facts.js';
import { buildSteps } from './steps.js';

const AT = new Date('2026-10-30T10:00:00.000Z');
const SITE = 'https://app.acme.example';

/** A workspace that has just signed up: nothing set up yet. */
const fresh = (): OnboardingFacts => ({
  embedded: true,
  connection: { kind: 'none' },
  hasContractSource: false,
  fields: { total: 0, mapped: 0 },
  handOverAt: null,
  widgetLoad: null,
  allowedOrigins: [],
  categories: 0,
  articles: 0,
  apiKeys: 0,
  webhooks: 0,
  failedDelivery: null,
  firstRealTicketAt: null,
  testTicket: null,
});

/** Everything set up and seen working. */
const finished = (): OnboardingFacts => ({
  ...fresh(),
  connection: { kind: 'saved', lastTest: { ok: true, at: AT, detail: 'Found Ada: 3 facts' } },
  fields: { total: 2, mapped: 1 },
  handOverAt: AT,
  widgetLoad: { at: AT, origin: SITE },
  allowedOrigins: [SITE],
  categories: 2,
  articles: 1,
  apiKeys: 1,
  firstRealTicketAt: AT,
});

const step = (facts: OnboardingFacts, id: OnboardingStepId): OnboardingStep => {
  const found = buildSteps(facts).find((s) => s.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
};

describe('buildSteps: the eight setup steps from real checks', () => {
  it('lists the eight steps in order, only API keys + webhooks optional', () => {
    const steps = buildSteps(fresh());
    expect(steps.map((s) => s.id)).toEqual([
      'connect',
      'fields',
      'signIn',
      'widget',
      'origins',
      'teach',
      'extras',
      'test',
    ]);
    expect(steps.filter((s) => s.optional).map((s) => s.id)).toEqual(['extras']);
    expect(steps.every((s) => s.state === 'todo')).toBe(true);
  });

  it('ticks every step once everything is set up and seen working', () => {
    const steps = buildSteps(finished());
    expect(steps.map((s) => s.state)).toEqual(Array(8).fill('done'));
    expect(step(finished(), 'signIn').at).toBe(AT.toISOString());
    expect(step(finished(), 'widget').detail).toContain(SITE);
  });

  it('connect: saved but never tested is to do; a failed test is broken with the reason', () => {
    const untested = { ...fresh(), connection: { kind: 'saved' as const, lastTest: null } };
    expect(step(untested, 'connect').state).toBe('todo');
    const failed = {
      ...fresh(),
      connection: {
        kind: 'saved' as const,
        lastTest: { ok: false, at: AT, detail: 'customers: HTTP 401' },
      },
    };
    expect(step(failed, 'connect')).toMatchObject({ state: 'broken' });
    expect(step(failed, 'connect').detail).toContain('customers: HTTP 401');
  });

  it("connect: the server's own settings (BookLeaf on env) count as connected", () => {
    expect(step({ ...fresh(), connection: { kind: 'env' } }, 'connect').state).toBe('done');
  });

  it('fields: needs one mapped field and a passing test', () => {
    const saved = finished();
    expect(step({ ...saved, fields: { total: 3, mapped: 0 } }, 'fields').state).toBe('todo');
    const failing = {
      ...saved,
      connection: {
        kind: 'saved' as const,
        lastTest: { ok: false, at: AT, detail: 'timed out' },
      },
    };
    expect(step(failing, 'fields').state).toBe('broken');
    const untested = { ...saved, connection: { kind: 'saved' as const, lastTest: null } };
    expect(step(untested, 'fields').state).toBe('todo');
  });

  it('fields: a full-shape source fills every field by key', () => {
    const facts = { ...finished(), hasContractSource: true, fields: { total: 4, mapped: 0 } };
    expect(step(facts, 'fields')).toMatchObject({ state: 'done' });
    expect(step(facts, 'fields').detail).toContain('4 fields');
  });

  it('widget: broken when embedding is off, or the last site is no longer allowed', () => {
    expect(step({ ...finished(), embedded: false }, 'widget').state).toBe('broken');
    const moved = { ...finished(), allowedOrigins: ['https://other.example'] };
    expect(step(moved, 'widget')).toMatchObject({ state: 'broken' });
    expect(step(moved, 'widget').detail).toContain(SITE);
  });

  it('teach: needs one category and one knowledge article', () => {
    expect(step({ ...fresh(), categories: 1 }, 'teach').state).toBe('todo');
    expect(step({ ...fresh(), articles: 1 }, 'teach').state).toBe('todo');
    expect(step({ ...fresh(), categories: 1, articles: 1 }, 'teach').state).toBe('done');
  });

  it('extras: a webhook delivery that gave up makes the optional step broken', () => {
    const facts = {
      ...finished(),
      webhooks: 1,
      failedDelivery: { event: 'ticket.created', responseStatus: 500, lastError: null },
    };
    expect(step(facts, 'extras')).toMatchObject({ state: 'broken', optional: true });
    expect(step(facts, 'extras').detail).toContain('HTTP 500');
  });

  it('test: a test ticket alone does not tick it; a real ticket does', () => {
    const sent = {
      ...fresh(),
      testTicket: { id: 'x', label: 'AC-1001', createdAt: AT },
    };
    expect(step(sent, 'test')).toMatchObject({ state: 'todo' });
    expect(step(sent, 'test').detail).toContain('AC-1001');
    expect(step({ ...sent, firstRealTicketAt: AT }, 'test').state).toBe('done');
  });

  it('keeps every detail within the 500-character limit', () => {
    const long = 'x'.repeat(2000);
    const facts = {
      ...fresh(),
      connection: { kind: 'saved' as const, lastTest: { ok: false, at: AT, detail: long } },
      webhooks: 1,
      failedDelivery: { event: 'ticket.created', responseStatus: null, lastError: long },
    };
    expect(buildSteps(facts).every((s) => s.detail.length <= 500)).toBe(true);
  });
});
