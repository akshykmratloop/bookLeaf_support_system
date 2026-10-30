import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../platform/errors.js';
import { createSessionTokens, type Session } from './session.js';
import { createSessionCodec, type SessionVersions } from './session-versions.js';

const SECRET = 'unit-test-jwt-secret-that-is-long-enough-123';
const SESSION: Session = {
  userId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  workspaceId: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a',
  role: 'ADMIN',
  authorId: null,
  name: 'Neha Verma',
  email: 'admin@bookleaf.demo',
};

/** Versions held in a map (the real store is one Postgres column, covered by integration tests). */
function setup() {
  const clock = { now: () => new Date(), dataAsOf: () => new Date('2025-12-31T00:00:00Z') };
  const store = new Map<string, number>([[SESSION.userId, 1]]);
  const versions: SessionVersions = {
    current: async ({ userId }) => store.get(userId) ?? null,
    bumpFrom: async ({ userId }, from) => {
      if (store.get(userId) === from) store.set(userId, from + 1);
    },
  };
  const tokens = createSessionTokens(SECRET, 8, clock);
  return { store, tokens, sessions: createSessionCodec(tokens, versions) };
}

describe('session versions', () => {
  it('accepts a token while its version is current', async () => {
    const { sessions } = setup();
    const token = await sessions.sign(SESSION);
    await expect(sessions.verify(token)).resolves.toEqual(SESSION);
  });

  it('refuses a token once the version has moved on', async () => {
    const { sessions, store } = setup();
    const token = await sessions.sign(SESSION);
    store.set(SESSION.userId, 2);
    await expect(sessions.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('end() bumps the version once; an ended token cannot end the newer sessions', async () => {
    const { sessions, store } = setup();
    const old = await sessions.sign(SESSION);
    await sessions.end(old);
    expect(store.get(SESSION.userId)).toBe(2);
    await sessions.end(old);
    expect(store.get(SESSION.userId)).toBe(2);
  });

  it('end() ignores garbage, and sign() refuses an unknown account', async () => {
    const { sessions, store } = setup();
    await expect(sessions.end('not-a-token')).resolves.toBeUndefined();
    expect(store.get(SESSION.userId)).toBe(1);
    await expect(sessions.sign({ ...SESSION, userId: SESSION.workspaceId })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
