import { describe, expect, it } from 'vitest';
import { AI_OFF, NOT_IN_PLAN, lockReason } from './planLock';

describe('lockReason', () => {
  it('lets a channel the plan allows be switched on', () => {
    expect(lockReason(true, true, false)).toBeUndefined();
  });
  it('locks a channel the plan does not include', () => {
    expect(lockReason(false, true, false)).toBe(NOT_IN_PLAN);
  });
  it('explains AI being off before the plan', () => {
    expect(lockReason(false, false, false)).toBe(AI_OFF);
    expect(lockReason(true, false, false)).toBe(AI_OFF);
  });
  it('never locks a channel that is on, so it can be switched off', () => {
    expect(lockReason(false, false, true)).toBeUndefined();
  });
});
