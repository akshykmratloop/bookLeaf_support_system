import { describe, expect, it } from 'vitest';
import { summarizeUsage, type RunGroup } from './summary.js';

const SINCE = new Date('2026-10-03T00:00:00.000Z');
const ok = (task: string, count: number, costMicros: number): RunGroup => ({
  task,
  outcome: 'OK',
  count,
  costMicros,
});
const failed = (task: string, count: number, costMicros = 0): RunGroup => ({
  task,
  outcome: 'ERROR',
  count,
  costMicros,
});

describe('summarizeUsage', () => {
  it('counts each feature in its own unit with its cost per unit', () => {
    const report = summarizeUsage({
      runs: [ok('TRIAGE', 4, 1_000), ok('DRAFT', 3, 9_000), ok('CHAT', 10, 2_500)],
      callSeconds: 0,
      days: 30,
      since: SINCE,
    });
    expect(report.features).toEqual([
      { feature: 'TRIAGE', unit: 'ticket', units: 4, costMicros: 1_000, costPerUnitMicros: 250 },
      { feature: 'DRAFT', unit: 'draft', units: 3, costMicros: 9_000, costPerUnitMicros: 3_000 },
      { feature: 'CHAT', unit: 'reply', units: 10, costMicros: 2_500, costPerUnitMicros: 250 },
      { feature: 'VOICE', unit: 'minute', units: 0, costMicros: 0, costPerUnitMicros: null },
    ]);
    expect(report).toMatchObject({ days: 30, since: SINCE.toISOString() });
  });

  it('per ticket is sorting plus drafting, over the tickets sorted', () => {
    const report = summarizeUsage({
      runs: [ok('TRIAGE', 4, 1_000), ok('DRAFT', 3, 9_000)],
      callSeconds: 0,
      days: 30,
      since: SINCE,
    });
    expect(report.perTicketMicros).toBe(2_500);
  });

  it('only successful runs count as units; failed ones still add their cost', () => {
    const report = summarizeUsage({
      runs: [ok('TRIAGE', 2, 600), failed('TRIAGE', 5, 40), failed('CHAT', 3)],
      callSeconds: 0,
      days: 30,
      since: SINCE,
    });
    const [triage, , chat] = report.features;
    expect(triage).toMatchObject({ units: 2, costMicros: 640, costPerUnitMicros: 320 });
    expect(chat).toMatchObject({ units: 0, costMicros: 0, costPerUnitMicros: null });
  });

  it('voice is counted in call minutes, to one decimal', () => {
    const report = summarizeUsage({
      runs: [ok('VOICE', 2, 450_000), failed('VOICE', 1)],
      callSeconds: 270,
      days: 30,
      since: SINCE,
    });
    expect(report.features[3]).toEqual({
      feature: 'VOICE',
      unit: 'minute',
      units: 4.5,
      costMicros: 450_000,
      costPerUnitMicros: 100_000,
    });
  });

  it('totals the four features in dollars and credits; connection tests are left out', () => {
    const report = summarizeUsage({
      runs: [ok('TRIAGE', 1, 1_234), ok('VOICE', 1, 10_000), ok('TEST', 3, 999_999)],
      callSeconds: 60,
      days: 30,
      since: SINCE,
    });
    expect(report.totalCostMicros).toBe(11_234);
    expect(report.totalCredits).toBe(11.23);
    expect(report.features.map((f) => f.feature)).toEqual(['TRIAGE', 'DRAFT', 'CHAT', 'VOICE']);
  });

  it('nothing used: zero totals and no per-unit or per-ticket figures', () => {
    const report = summarizeUsage({ runs: [], callSeconds: 0, days: 30, since: SINCE });
    expect(report).toMatchObject({ totalCostMicros: 0, totalCredits: 0, perTicketMicros: null });
    expect(report.features.every((f) => f.costPerUnitMicros === null)).toBe(true);
  });
});
