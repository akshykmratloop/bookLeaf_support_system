import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bookId,
  call,
  createHarness,
  createTicket,
  deleteWorkspace,
  EMAILS,
  type Harness,
} from './helpers/app.js';

let h: Harness;
let kavita: string;
let bookleafAdmin: string;
let ticketId: string;

const OWNER = {
  workspaceName: 'Acme Lending',
  slug: 'acme',
  ownerName: 'Ada Owner',
  email: 'ada@acme.example',
  password: 'Correct-Horse-42',
};

const signup = (body: Record<string, unknown>) => call(h, 'POST', '/signup', undefined, body);

beforeAll(async () => {
  h = await createHarness();
  [kavita, bookleafAdmin] = await Promise.all([h.login(EMAILS.kavita), h.login(EMAILS.admin)]);
  const res = await createTicket(h, kavita, {
    bookId: await bookId(h, 'BK015'),
    subject: 'Where is my book?',
    description: 'Could you tell me where my book currently is in production?',
  });
  ticketId = res.json<{ id: string }>().id;
});
afterAll(async () => {
  await deleteWorkspace(h.db, 'acme');
  await deleteWorkspace(h.db, 'weak-co');
  await h.close();
});

describe('self-serve signup', () => {
  it('creates a workspace with its owner, who can sign in and see their workspace', async () => {
    const res = await signup(OWNER);
    expect(res.statusCode).toBe(201);
    const body = res.json<{
      workspace: { slug: string; isDefault: boolean };
      user: { email: string };
    }>();
    expect(body.workspace).toMatchObject({ slug: 'acme', isDefault: false });
    expect(body.user.email).toBe('ada@acme.example');
    expect(JSON.stringify(body)).not.toContain('Correct-Horse');

    const cookie = await h.login(OWNER.email, OWNER.password);
    const mine = await call(h, 'GET', '/workspace', cookie);
    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toMatchObject({ workspace: { slug: 'acme' }, role: 'OWNER' });
  });

  it('refuses a taken slug (409) and a reserved or malformed one (422)', async () => {
    expect((await signup({ ...OWNER, email: 'other@acme.example' })).statusCode).toBe(409);
    expect((await signup({ ...OWNER, slug: 'admin' })).statusCode).toBe(422);
    expect((await signup({ ...OWNER, slug: 'Bad Slug!' })).statusCode).toBe(422);
  });

  it('refuses a weak password (422) without creating anything', async () => {
    const res = await signup({ ...OWNER, slug: 'weak-co', password: 'short' });
    expect(res.statusCode).toBe(422);
    expect(await h.db.workspace.count({ where: { slug: 'weak-co' } })).toBe(0);
  });

  it('records the creation in the workspace audit log', async () => {
    const cookie = await h.login(OWNER.email, OWNER.password);
    const res = await call(h, 'GET', '/workspace/audit', cookie);
    expect(res.statusCode).toBe(200);
    const { items } = res.json<{ items: { action: string; entityType: string }[] }>();
    expect(items.some((e) => e.action === 'workspace.created')).toBe(true);
  });
});

describe('tenant isolation', () => {
  it("another workspace's admin cannot read a BookLeaf ticket (404) nor list it", async () => {
    const acme = await h.login(OWNER.email, OWNER.password);
    expect((await call(h, 'GET', `/tickets/${ticketId}`, acme)).statusCode).toBe(404);
    expect((await call(h, 'GET', `/tickets/${ticketId}/draft`, acme)).statusCode).toBe(404);
    const list = await call(h, 'GET', '/tickets', acme);
    expect(list.statusCode).toBe(200);
    expect(list.json<{ items: unknown[] }>().items).toEqual([]);
    expect((await call(h, 'GET', '/books', acme)).json<{ items: unknown[] }>().items).toEqual([]);
  });

  it("BookLeaf's admin still sees it, and the ticket row carries the default workspace", async () => {
    expect((await call(h, 'GET', `/tickets/${ticketId}`, bookleafAdmin)).statusCode).toBe(200);
    const ticket = await h.db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const kavitaRow = await h.db.author.findUniqueOrThrow({ where: { id: ticket.authorId } });
    expect(ticket.workspaceId).toBe(kavitaRow.workspaceId);
    expect(await h.db.workspace.findUnique({ where: { id: ticket.workspaceId } })).toMatchObject({
      slug: 'bookleaf',
      isDefault: true,
    });
  });

  it("a session forged for another workspace's admin user id cannot cross over", async () => {
    const acmeUser = await h.db.user.findFirstOrThrow({ where: { email: OWNER.email } });
    const forged = await h.container.sessions.sign({
      userId: acmeUser.id,
      workspaceId: acmeUser.workspaceId,
      role: 'ADMIN',
      authorId: null,
      name: 'Forged',
      email: OWNER.email,
    });
    const res = await call(h, 'GET', `/tickets/${ticketId}`, `bl_session=${forged}`);
    expect(res.statusCode).toBe(404);
  });
});
