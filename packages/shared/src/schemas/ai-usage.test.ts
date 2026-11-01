import { describe, expect, it } from 'vitest';
import { AiUsageSchema, MICROS_PER_CREDIT, microsToCredits } from './ai-usage.js';

describe('credits', () => {
  it('1 credit is $0.001 (1,000 micro-dollars)', () => {
    expect(MICROS_PER_CREDIT).toBe(1_000);
    expect(microsToCredits(1_000)).toBe(1);
    expect(microsToCredits(0)).toBe(0);
  });

  it('keeps up to two decimals', () => {
    expect(microsToCredits(1_234)).toBe(1.23);
    expect(microsToCredits(1_235)).toBe(1.24);
    expect(microsToCredits(5)).toBe(0.01);
    expect(microsToCredits(4)).toBe(0);
  });
});

describe('AiUsageSchema', () => {
  const report = {
    days: 30,
    since: '2026-10-03T00:00:00.000Z',
    totalCostMicros: 2_000,
    totalCredits: 2,
    features: [
      {
        feature: 'VOICE',
        unit: 'minute',
        units: 1.5,
        costMicros: 2_000,
        costPerUnitMicros: 1_333,
      },
    ],
    perTicketMicros: null,
  };

  it('accepts a report with fractional call minutes and no tickets', () => {
    expect(AiUsageSchema.parse(report)).toEqual(report);
  });

  it('refuses an unknown feature or a negative cost', () => {
    const feature = { ...report.features[0], feature: 'TEST' };
    expect(AiUsageSchema.safeParse({ ...report, features: [feature] }).success).toBe(false);
    expect(AiUsageSchema.safeParse({ ...report, totalCostMicros: -1 }).success).toBe(false);
  });
});
