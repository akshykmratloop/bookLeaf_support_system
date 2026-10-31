import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, deleteWorkspace, type Harness } from './helpers/app.js';
import { ownerOf } from './helpers/workspaces.js';

/**
 * Signup limits: each visitor (address + email) gets SIGNUPS_PER_HOUR tries, so people behind
 * one proxy address do not block each other; all signups together are capped at ten times that.
 */
const PER_VISITOR = 2;
const PLATFORM_CAP = PER_VISITOR * 10;
let h: Harness;
let handled = 0;
const slugs: string[] = [];

const signup = (slug: string, email: string) => {
  slugs.push(slug);
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/signup',
    remoteAddress: '192.0.2.10',
    payload: { ...ownerOf(slug, 'Limit Co'), email },
  });
};
const freshSlug = () => `limits-${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: String(PER_VISITOR) } });
});
afterAll(async () => {
  for (const slug of slugs) await deleteWorkspace(h.db, slug);
  await h.close();
});

describe('POST /signup limits', () => {
  it('limits one email on an address without blocking another email on it', async () => {
    const email = `first-${randomUUID().slice(0, 8)}@limits.example`;
    expect((await signup(freshSlug(), email)).statusCode).toBe(201);
    expect((await signup(freshSlug(), email)).statusCode).toBe(409);
    handled += 2;
    expect((await signup(freshSlug(), email)).statusCode).toBe(429);
    const other = await signup(freshSlug(), `second-${randomUUID().slice(0, 8)}@limits.example`);
    expect(other.statusCode).toBe(201);
    handled += 1;
  });

  it('caps all signups together at ten times the per-visitor limit', async () => {
    for (; handled < PLATFORM_CAP; handled += 1) {
      const res = await signup(freshSlug(), `many-${randomUUID().slice(0, 8)}@limits.example`);
      expect(res.statusCode).toBe(201);
    }
    const over = await signup(freshSlug(), `over-${randomUUID().slice(0, 8)}@limits.example`);
    expect(over.statusCode).toBe(429);
    expect(over.json<{ code: string }>().code).toBe('SIGNUPS_BUSY');
  });
});
