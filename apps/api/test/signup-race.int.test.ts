import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, createHarness, deleteWorkspace, type Harness } from './helpers/app.js';

/**
 * Two signups racing for the same email (or the same name) must both get a clear 409 for the
 * loser, never a 500 and never the wrong reason. The database's unique index decides the race.
 */
let h: Harness;
const SLUGS = ['race-one', 'race-two', 'race-same'];

const owner = (slug: string, email: string, name = `Race ${slug}`) => ({
  workspaceName: name,
  slug,
  ownerName: 'Race Owner',
  email,
  password: 'Correct-Horse-42',
});

beforeAll(async () => {
  h = await createHarness();
  for (const s of SLUGS) await deleteWorkspace(h.db, s);
});
afterAll(async () => {
  for (const s of SLUGS) await deleteWorkspace(h.db, s);
  await h.close();
});

describe('signup races', () => {
  it('gives the loser of a same-email race 409 EMAIL_TAKEN', async () => {
    const email = 'race@signup.example';
    const results = await Promise.all([
      call(h, 'POST', '/signup', undefined, owner('race-one', email)),
      call(h, 'POST', '/signup', undefined, owner('race-two', email)),
    ]);
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([201, 409]);
    const loser = results.find((r) => r.statusCode === 409);
    expect(loser?.json()).toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('gives the loser of a same-name race 409 SLUG_TAKEN', async () => {
    const results = await Promise.all([
      call(h, 'POST', '/signup', undefined, owner('race-same', 'a@race.example')),
      call(h, 'POST', '/signup', undefined, owner('race-same', 'b@race.example')),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.statusCode === 409)?.json()).toMatchObject({
      code: 'SLUG_TAKEN',
    });
  });
});
