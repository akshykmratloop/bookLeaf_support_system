import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/modules/auth/password.js';
import { call, createHarness, deleteWorkspace, type Harness } from './helpers/app.js';

/**
 * F-12 part 2: each session token carries the user's session version, and every request checks it
 * against `users.session_version`. Logout, a password change and removal from the workspace bump
 * the version, so every cookie issued before stops working (on all devices).
 * Uses its own workspace: bumping a shared demo admin would sign out other test files.
 */
let h: Harness;

const OWNER = {
  workspaceName: 'Session Revocation Co',
  slug: 'session-revocation',
  ownerName: 'Sam Owner',
  email: 'sam@session-revocation.example',
  password: 'Correct-Horse-42',
};
const NEW_PASSWORD = 'Battery-Staple-77';

const me = (cookie: string) => call(h, 'GET', '/auth/me', cookie);
const owner = () => h.db.user.findFirstOrThrow({ where: { loginEmail: OWNER.email } });

async function signIn(password = OWNER.password): Promise<string> {
  return h.login(OWNER.email, password);
}

/** A cookie issued exactly as login issues it, without the 5-a-minute login limit. */
async function issue(): Promise<string> {
  const user = await owner();
  const token = await h.container.sessions.sign({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
    authorId: null,
    name: user.name,
    email: user.email,
  });
  return `bl_session=${token}`;
}

beforeAll(async () => {
  h = await createHarness();
  await deleteWorkspace(h.db, OWNER.slug);
  expect((await call(h, 'POST', '/signup', undefined, OWNER)).statusCode).toBe(201);
});
afterAll(async () => {
  await deleteWorkspace(h.db, OWNER.slug);
  await h.close();
});

describe('logout', () => {
  it('ends that session and every other session of the user', async () => {
    const [laptop, phone] = [await signIn(), await signIn()];
    expect((await me(laptop)).statusCode).toBe(200);
    expect((await me(phone)).statusCode).toBe(200);
    expect((await call(h, 'POST', '/auth/logout', laptop)).statusCode).toBe(204);
    expect((await me(laptop)).statusCode).toBe(401);
    expect((await me(phone)).statusCode).toBe(401);
    expect((await me(await signIn())).statusCode).toBe(200);
  });

  it('with an already ended cookie does not sign out the newer sessions', async () => {
    const old = await issue();
    await call(h, 'POST', '/auth/logout', old);
    const fresh = await issue();
    expect((await call(h, 'POST', '/auth/logout', old)).statusCode).toBe(204);
    expect((await me(fresh)).statusCode).toBe(200);
  });
});

describe('password change', () => {
  it('makes every cookie issued before it invalid (401); the new password signs in', async () => {
    const before = await issue();
    expect((await me(before)).statusCode).toBe(200);
    const { id } = await owner();
    await h.db.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(NEW_PASSWORD) },
    });
    expect((await me(before)).statusCode).toBe(401);
    expect((await me(await signIn(NEW_PASSWORD))).statusCode).toBe(200);
  });

  it('a change to other fields keeps the session', async () => {
    const cookie = await issue();
    const { id } = await owner();
    await h.db.user.update({ where: { id }, data: { name: 'Sam Renamed' } });
    expect((await me(cookie)).statusCode).toBe(200);
  });
});

describe('removal from the workspace', () => {
  it("ends the removed member's sessions (401)", async () => {
    const cookie = await issue();
    expect((await call(h, 'GET', '/workspace', cookie)).statusCode).toBe(200);
    const { id } = await owner();
    await h.db.workspaceMember.deleteMany({ where: { userId: id } });
    expect((await me(cookie)).statusCode).toBe(401);
    expect((await call(h, 'GET', '/workspace', cookie)).statusCode).toBe(401);
  });
});

describe('tokens the server cannot match to a current account', () => {
  it('refuses a token without a session version (issued before this change)', async () => {
    const { id, workspaceId } = await owner();
    const legacy = await new SignJWT({
      workspaceId,
      role: 'ADMIN',
      authorId: null,
      name: 'Sam',
      email: OWNER.email,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(id)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(h.container.env.JWT_SECRET));
    expect((await me(`bl_session=${legacy}`)).statusCode).toBe(401);
  });

  it('cannot issue a session for an account that does not exist', async () => {
    const ghost = {
      userId: '00000000-0000-4000-8000-00000000dead',
      workspaceId: (await owner()).workspaceId,
      role: 'ADMIN' as const,
      authorId: null,
      name: 'Ghost',
      email: 'ghost@session-revocation.example',
    };
    await expect(h.container.sessions.sign(ghost)).rejects.toThrow();
  });
});
