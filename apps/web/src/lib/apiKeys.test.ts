import type { ApiKey } from '@bookleaf/shared';
import { describe, expect, it } from 'vitest';
import { groupKeys, keyDates, newKeyErrors, toggleScope } from './apiKeys';

const key = (over: Partial<ApiKey>): ApiKey => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Production',
  prefix: 'blsk_ab12cd34',
  scopes: ['tickets:read'],
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

describe('groupKeys', () => {
  it('keeps active keys apart from revoked ones, each newest first as given', () => {
    const a = key({ id: 'a' });
    const r = key({ id: 'r', revokedAt: '2026-10-02T10:00:00.000Z' });
    const b = key({ id: 'b' });
    expect(groupKeys([a, r, b])).toEqual({ active: [a, b], revoked: [r] });
  });
});

describe('toggleScope', () => {
  it('adds and removes a scope, always in the catalogue order', () => {
    expect(toggleScope(['tickets:write'], 'customers:read', true)).toEqual([
      'customers:read',
      'tickets:write',
    ]);
    expect(toggleScope(['customers:read', 'tickets:read'], 'customers:read', false)).toEqual([
      'tickets:read',
    ]);
    expect(toggleScope(['tickets:read'], 'tickets:read', true)).toEqual(['tickets:read']);
  });
});

describe('keyDates', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z');
  it('says when a key was created and last used', () => {
    expect(keyDates(key({}), now)).toEqual({ created: '1 Oct 2026', used: 'Never used' });
    const used = key({ lastUsedAt: '2026-10-01T11:30:00.000Z' });
    expect(keyDates(used, now).used).toBe('Last used 30 min ago');
  });
  it('says when a revoked key was revoked', () => {
    const r = key({ revokedAt: '2026-10-01T11:00:00.000Z' });
    expect(keyDates(r, now).used).toBe('Revoked 1 h ago');
  });
});

describe('newKeyErrors', () => {
  it('asks for a name and at least one permission', () => {
    expect(newKeyErrors('  ', [])).toEqual({
      name: 'Give the key a name, e.g. Production server',
      scopes: 'Pick at least one permission',
    });
    expect(newKeyErrors('x'.repeat(61), ['tickets:read']).name).toBe('Use at most 60 characters');
    expect(newKeyErrors('Production', ['tickets:read'])).toEqual({});
  });
});
