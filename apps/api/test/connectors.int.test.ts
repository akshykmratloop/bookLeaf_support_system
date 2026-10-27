import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HOST_TOKEN_AUDIENCE } from '@bookleaf/shared';
import { call, createHarness, deleteWorkspace, EMAILS, HOST, type Harness } from './helpers/app.js';

let h: Harness;
let acme: string;
let bookleafAdmin: string;

const OWNER = {
  workspaceName: 'Acme Lending',
  slug: 'acme',
  ownerName: 'Ada Owner',
  email: 'ada@acme.example',
  password: 'Correct-Horse-42',
};
const ACME_SECRET = 'acme-signing-secret-that-is-long-enough-123456';

/** What Acme's product would do: a hand-over token naming its workspace in `iss`. */
function acmeToken(sub: string, secret = ACME_SECRET, iss = 'acme') {
  return new SignJWT({ name: 'Priya Sharma', email: 'priya.sharma@email.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setJti(randomUUID())
    .setAudience(HOST_TOKEN_AUDIENCE)
    .setIssuer(iss)
    .setIssuedAt()
    .setExpirationTime('300s')
    .sign(new TextEncoder().encode(secret));
}

beforeAll(async () => {
  h = await createHarness();
  await call(h, 'POST', '/signup', undefined, OWNER);
  [acme, bookleafAdmin] = await Promise.all([
    h.login(OWNER.email, OWNER.password),
    h.login(EMAILS.admin),
  ]);
});
afterAll(async () => {
  await deleteWorkspace(h.db, 'acme');
  await h.close();
});

describe('product connection (connector)', () => {
  it('starts unconfigured for a new workspace, and on env for the default one', async () => {
    const mine = await call(h, 'GET', '/workspace/connector', acme);
    expect(mine.json()).toMatchObject({ configured: false, source: 'NONE', apiKey: null });
    const bl = await call(h, 'GET', '/workspace/connector', bookleafAdmin);
    expect(bl.json()).toMatchObject({ configured: true, source: 'ENV', baseUrl: h.hostUrl });
    expect(JSON.stringify(bl.json())).not.toContain(HOST.apiKey);
  });

  it('needs both secrets the first time (422)', async () => {
    const res = await call(h, 'PUT', '/workspace/connector', acme, {
      version: 0,
      baseUrl: h.hostUrl,
    });
    expect(res.statusCode).toBe(422);
    const paths = res.json<{ errors: { path: string }[] }>().errors.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['apiKey', 'signingSecret']));
  });

  it('saves the connection, encrypts the secrets and returns hints only', async () => {
    const res = await call(h, 'PUT', '/workspace/connector', acme, {
      version: 0,
      baseUrl: `${h.hostUrl}/`,
      apiKey: HOST.apiKey,
      signingSecret: ACME_SECRET,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ source: string; apiKey: { hint: string }; version: number }>();
    expect(body.source).toBe('WORKSPACE');
    expect(body.apiKey.hint).toBe(`…${HOST.apiKey.slice(-4)}`);
    expect(JSON.stringify(body)).not.toContain(HOST.apiKey);
    expect(JSON.stringify(body)).not.toContain(ACME_SECRET);
    const row = await h.db.workspaceConnector.findFirstOrThrow({
      where: { workspace: { slug: 'acme' } },
    });
    expect(row.apiKeyEnc).not.toContain(HOST.apiKey);
    expect(row.signingSecretEnc).not.toContain(ACME_SECRET);
    expect(row.apiKeyEnc.startsWith('v1.k1.')).toBe(true);
  });

  it('keeps secrets when they are omitted, and refuses a stale version (409)', async () => {
    const fresh = await call(h, 'PUT', '/workspace/connector', acme, {
      version: 0,
      baseUrl: h.hostUrl,
      timeoutMs: 2500,
    });
    expect(fresh.statusCode).toBe(200);
    expect(fresh.json()).toMatchObject({
      version: 1,
      timeoutMs: 2500,
      apiKey: { hint: `…${HOST.apiKey.slice(-4)}` },
    });
    const stale = await call(h, 'PUT', '/workspace/connector', acme, {
      version: 0,
      baseUrl: h.hostUrl,
    });
    expect(stale.statusCode).toBe(409);
  });

  it('tests the connection against the product for a known and an unknown customer', async () => {
    const ok = await call(h, 'POST', '/workspace/connector/test', acme, { customerId: 'AUTH001' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, items: 2 });
    const bad = await call(h, 'POST', '/workspace/connector/test', acme, { customerId: 'NOPE' });
    expect(bad.json()).toMatchObject({ ok: false });
    const shown = await call(h, 'GET', '/workspace/connector', acme);
    expect(shown.json<{ lastTest: { ok: boolean } }>().lastTest.ok).toBe(false);
  });

  it('authors are not allowed to read or change the connection (403)', async () => {
    const kavita = await h.login(EMAILS.kavita);
    expect((await call(h, 'GET', '/workspace/connector', kavita)).statusCode).toBe(403);
  });
});

describe("customers signing in from Acme's product", () => {
  it('a token naming the acme workspace signs in under acme, with its own customer rows', async () => {
    const res = await call(h, 'POST', '/auth/host', undefined, {
      token: await acmeToken('AUTH001'),
    });
    expect(res.statusCode).toBe(200);
    const cookie = `bl_session=${res.cookies.find((c) => c.name === 'bl_session')?.value}`;
    const books = await call(h, 'GET', '/books', cookie);
    expect(books.json<{ items: unknown[] }>().items).toHaveLength(2);
    const me = await call(h, 'GET', '/auth/me', cookie);
    const authorId = me.json<{ user: { authorId: string } }>().user.authorId;
    const row = await h.db.author.findUniqueOrThrow({
      where: { id: authorId },
      include: { workspace: true },
    });
    expect(row.workspace.slug).toBe('acme');
    expect(row.externalId).toBe('AUTH001');
  });

  it("the same person signing in from BookLeaf gets BookLeaf's row, not Acme's", async () => {
    await h.login(EMAILS.priya);
    const rows = await h.db.author.findMany({
      where: { externalId: 'AUTH001' },
      include: { workspace: true },
    });
    expect(rows.map((r) => r.workspace.slug).sort()).toEqual(['acme', 'bookleaf']);
  });

  it("refuses a token for acme signed with another workspace's secret, or for an unknown workspace", async () => {
    const forged = await call(h, 'POST', '/auth/host', undefined, {
      token: await acmeToken('AUTH001', HOST.signingSecret),
    });
    expect(forged.statusCode).toBe(401);
    const unknown = await call(h, 'POST', '/auth/host', undefined, {
      token: await acmeToken('AUTH001', ACME_SECRET, 'nobody'),
    });
    expect(unknown.statusCode).toBe(401);
  });

  it("an acme customer's ticket is invisible to BookLeaf's staff", async () => {
    const res = await call(h, 'POST', '/auth/host', undefined, {
      token: await acmeToken('AUTH001'),
    });
    const cookie = `bl_session=${res.cookies.find((c) => c.name === 'bl_session')?.value}`;
    const created = await call(h, 'POST', '/tickets', cookie, {
      bookId: null,
      subject: 'Acme question',
      description: 'A question raised through the acme product, not BookLeaf.',
    });
    expect(created.statusCode).toBe(201);
    const id = created.json<{ id: string }>().id;
    expect((await call(h, 'GET', `/tickets/${id}`, bookleafAdmin)).statusCode).toBe(404);
    expect((await call(h, 'GET', `/tickets/${id}`, acme)).statusCode).toBe(200);
  });
});

describe('connector URL safety (production policy)', () => {
  let strict: Harness;
  beforeAll(async () => {
    strict = await createHarness({ env: { CONNECTOR_ALLOW_PRIVATE_HOSTS: 'false' } });
  });
  afterAll(() => strict.close());

  it('refuses private, loopback and metadata addresses (422)', async () => {
    const admin = await strict.login(EMAILS.admin);
    for (const baseUrl of [
      'https://169.254.169.254/',
      'http://127.0.0.1:3200',
      'https://localhost',
    ]) {
      const res = await call(strict, 'PUT', '/workspace/connector', admin, {
        version: 0,
        baseUrl,
        apiKey: HOST.apiKey,
        signingSecret: ACME_SECRET,
      });
      expect(res.statusCode).toBe(422);
      expect(res.json<{ errors: { path: string }[] }>().errors[0]?.path).toBe('baseUrl');
    }
  });
});
