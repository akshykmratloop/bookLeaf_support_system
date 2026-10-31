import { describe, expect, it } from 'vitest';
import { AiConfig } from '../../config/ai.js';
import { assertLeaseCoversCalls, DEFAULT_LEASE_MS, LeaseTooShortError } from './lease.js';

describe('the AI job lease', () => {
  it('the default lease outlasts the AI timeout, the longest host timeout and the margin', () => {
    expect(() => assertLeaseCoversCalls(DEFAULT_LEASE_MS, 10_000)).not.toThrow();
  });

  it('refuses a lease a slow job could outlive', () => {
    expect(() => assertLeaseCoversCalls(30_000, 3_000)).toThrow(LeaseTooShortError);
    expect(() => assertLeaseCoversCalls(33_000, 3_000)).toThrow(LeaseTooShortError);
    expect(() => assertLeaseCoversCalls(33_001, 3_000)).not.toThrow();
  });
});

describe('worker and budget settings', () => {
  it('default to 2 claim loops and 2000 AI runs a day', () => {
    const env = AiConfig.parse({});
    expect(env.WORKER_CONCURRENCY).toBe(2);
    expect(env.AI_TICKET_RUNS_PER_WORKSPACE_PER_DAY).toBe(2000);
  });

  it('keep WORKER_CONCURRENCY between 1 and 8', () => {
    expect(AiConfig.parse({ WORKER_CONCURRENCY: '8' }).WORKER_CONCURRENCY).toBe(8);
    expect(AiConfig.safeParse({ WORKER_CONCURRENCY: '0' }).success).toBe(false);
    expect(AiConfig.safeParse({ WORKER_CONCURRENCY: '9' }).success).toBe(false);
  });
});
