import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { appRoleFrom, ensureAppRole } from '../src/platform/db-roles.js';
import { dbRoleProblems } from '../src/platform/db-role-check.js';
import { asPlatform, withWorkspace } from '../src/platform/tenancy.js';
import { createHarness, deleteWorkspace, type Harness } from './helpers/app.js';
import { ownerOf, signupWorkspace } from './helpers/workspaces.js';

/**
 * S.8: Postgres itself keeps workspaces apart. Every query below deliberately has NO workspace
 * filter; the restricted app role plus `app.workspace_id` must still hide the other workspace.
 */
let h: Harness;
const ws = { a: '', b: '' };
const tickets = { a: '', b: '' };
const SLUGS = { a: 'rls-acme', b: 'rls-beta' };

async function seedTicket(workspaceId: string, slug: string): Promise<string> {
  const user = await h.db.user.create({
    data: { workspaceId, email: `author@${slug}.example`, name: 'Sam Lee', role: 'AUTHOR' },
  });
  const author = await h.db.author.create({
    data: { workspaceId, userId: user.id, externalId: `AUTH-${slug}` },
  });
  const ticket = await h.db.ticket.create({
    data: {
      workspaceId,
      authorId: author.id,
      number: 1001,
      subject: `${slug} subject`,
      description: `${slug} private description`,
      slaDueAt: h.clock.now(),
    },
  });
  await h.db.ticketMessage.create({
    data: { ticketId: ticket.id, kind: 'AUTHOR', body: `${slug} message` },
  });
  return ticket.id;
}

beforeAll(async () => {
  h = await createHarness({ env: { SIGNUPS_PER_HOUR: '50' } });
  for (const key of ['a', 'b'] as const) {
    await signupWorkspace(h, ownerOf(SLUGS[key], `RLS ${key}`));
    ws[key] = (await h.db.workspace.findUniqueOrThrow({ where: { slug: SLUGS[key] } })).id;
    tickets[key] = await seedTicket(ws[key], SLUGS[key]);
  }
});

afterAll(async () => {
  for (const slug of Object.values(SLUGS)) await deleteWorkspace(h.db, slug);
  await h.close();
});

const asA = <T>(fn: () => T | PromiseLike<T>): Promise<T> => withWorkspace(ws.a, fn);

describe('row-level security policies (S.8)', () => {
  it('covers every table that has a workspace_id, plus the workspace and child tables', async () => {
    const rows = await h.db.$queryRaw<{ table: string; enabled: boolean; forced: boolean }[]>`
      SELECT c.relname AS table, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind = 'r'
        AND (c.relname IN ('workspaces', 'ticket_messages', 'ai_jobs', 'ai_drafts', 'ai_runs',
                           'chat_messages', 'webhook_deliveries')
             OR EXISTS (SELECT 1 FROM information_schema.columns col
                        WHERE col.table_schema = n.nspname AND col.table_name = c.relname
                          AND col.column_name = 'workspace_id'))`;
    expect(rows.length).toBeGreaterThanOrEqual(25);
    for (const row of rows) expect(row, row.table).toMatchObject({ enabled: true, forced: true });
    const policies = await h.db.$queryRaw<{ table: string }[]>`
      SELECT tablename AS table FROM pg_policies WHERE policyname = 'workspace_isolation'`;
    expect(new Set(policies.map((p) => p.table))).toEqual(new Set(rows.map((r) => r.table)));
  });

  it('serves requests with a role that cannot bypass RLS, and platform work with one that can', async () => {
    expect(await dbRoleProblems(h.container.db)).toEqual([]);
  });

  it('sets up the app role idempotently (every deploy runs it again)', async () => {
    const role = appRoleFrom(inject('databaseUrl'), inject('databaseAdminUrl'));
    await ensureAppRole(h.db, role);
    await ensureAppRole(h.db, role);
    expect(await dbRoleProblems(h.container.db)).toEqual([]);
  });
});

describe('a query with no workspace filter (S.8)', () => {
  it('reads only its own workspace, through every table and in transactions', async () => {
    const db = h.container.db;
    const found = await asA(() => db.ticket.findMany({ select: { id: true, workspaceId: true } }));
    expect(found.map((t) => t.id)).toEqual([tickets.a]);
    expect(await asA(() => db.workspace.findMany({ select: { id: true } }))).toEqual([
      { id: ws.a },
    ]);
    const messages = await asA(() => db.ticketMessage.findMany({ select: { ticketId: true } }));
    expect(new Set(messages.map((m) => m.ticketId))).toEqual(new Set([tickets.a]));
    const users = await asA(() => db.user.findMany({ select: { workspaceId: true } }));
    expect(new Set(users.map((u) => u.workspaceId))).toEqual(new Set([ws.a]));
    const inTx = await asA(() => db.$transaction((tx) => tx.ticket.count()));
    expect(inTx).toBe(1);
    const raw = await asA(
      () =>
        db.$queryRaw<
          { n: bigint }[]
        >`SELECT count(*) AS n FROM tickets WHERE id = ${tickets.b}::uuid`,
    );
    expect(Number(raw[0]?.n)).toBe(0);
  });

  it("cannot change or add another workspace's rows", async () => {
    const db = h.container.db;
    const hidden = await asA(() =>
      db.ticket.updateMany({ where: { id: tickets.b }, data: { subject: 'taken over' } }),
    );
    expect(hidden.count).toBe(0);
    await expect(
      asA(() => db.ticket.update({ where: { id: tickets.b }, data: { subject: 'taken over' } })),
    ).rejects.toThrow();
    await expect(
      asA(() =>
        db.ticketMessage.create({
          data: { ticketId: tickets.b, kind: 'INTERNAL_NOTE', body: 'x' },
        }),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asA(() =>
        db.$transaction((tx) =>
          tx.customerField.create({
            data: { workspaceId: ws.b, key: 'planted', label: 'Planted', type: 'TEXT' },
          }),
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await asA(() => db.ticket.deleteMany({ where: { id: tickets.b } }))).toEqual({
      count: 0,
    });
    const b = await h.db.ticket.findUniqueOrThrow({ where: { id: tickets.b } });
    expect(b.subject).toBe(`${SLUGS.b} subject`);
  });

  it('sees no tenant rows at all outside a scope (default deny)', async () => {
    const db = h.container.db;
    expect(await db.ticket.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
    expect(await db.workspace.count()).toBe(0);
  });

  it('sees every workspace on the platform (owner) path', async () => {
    const count = await asPlatform(() =>
      h.container.db.ticket.count({ where: { id: { in: [tickets.a, tickets.b] } } }),
    );
    expect(count).toBe(2);
  });

  it('refuses batch transactions in a workspace scope (they cannot set the workspace)', async () => {
    const db = h.container.db;
    return expect(asA(() => db.$transaction([db.ticket.count()]))).rejects.toThrow(/async \(tx\)/);
  });

  it("still ends a removed member's sessions (F-12 trigger under RLS)", async () => {
    const owner = await h.db.user.findFirstOrThrow({
      where: { loginEmail: `owner@${SLUGS.a}.example` },
    });
    await asA(() => h.container.db.workspaceMember.deleteMany({ where: { userId: owner.id } }));
    const after = await h.db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(after.sessionVersion).toBe(owner.sessionVersion + 1);
  });
});
