import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb, type Db } from '../src/platform/db.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';

/**
 * S.9 migration on a populated database: tickets and drafts carry the old enum category. Every
 * ticket keeps its category through the new category_key, each workspace gets the categories
 * its data uses (BookLeaf all six), and the old column is left untouched (expand step only).
 */
const S9 = '20261030120000_workspace_categories_and_knowledge';
const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const DB_NAME = `s9_migration_${process.pid}`;
const ACME = '00000000-0000-4000-8000-00000000ac09';
const EMPTY = '00000000-0000-4000-8000-00000000e909';

let admin: Db;
let db: Db;
let work: string;
let url: string;

function deploy(): void {
  execFileSync(
    `${apiRoot}node_modules/.bin/prisma`,
    ['migrate', 'deploy', '--schema', join(work, 'schema.prisma')],
    { cwd: apiRoot, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
  );
}

/** The migrations folder up to (or, once `withS9`, including) S.9. */
function stageMigrations(withS9: boolean): void {
  const from = join(apiRoot, 'prisma', 'migrations');
  for (const name of readdirSync(from)) {
    if (name !== 'migration_lock.toml' && (withS9 ? name > S9 : name >= S9)) continue;
    cpSync(join(from, name), join(work, 'migrations', name), { recursive: true });
  }
}

const sql = (query: string, ...values: unknown[]) => db.$executeRawUnsafe(query, ...values);

async function populate(): Promise<void> {
  await sql(
    `INSERT INTO workspaces (id, slug, name, ticket_prefix, updated_at) VALUES
     ($1::uuid, 'acme-s9', 'Acme', 'AS9', now()), ($2::uuid, 'empty-s9', 'Empty', 'ES9', now())`,
    ACME,
    EMPTY,
  );
  const authors: Record<string, string> = {};
  for (const [ws, id] of [
    [DEFAULT_WORKSPACE_ID, '00000000-0000-4000-8000-0000000b0901'],
    [ACME, '00000000-0000-4000-8000-0000000a0901'],
  ] as const) {
    await sql(
      `INSERT INTO users (id, workspace_id, email, name, role) VALUES ($1::uuid, $2::uuid, $1 || '@x.example', 'A', 'AUTHOR')`,
      id,
      ws,
    );
    await sql(
      `INSERT INTO authors (id, workspace_id, external_id, user_id) VALUES ($1::uuid, $2::uuid, $1, $1::uuid)`,
      id,
      ws,
    );
    authors[ws] = id;
  }
  const ticket = (ws: string, n: number, category: string | null) =>
    sql(
      `INSERT INTO tickets (id, number, workspace_id, author_id, subject, description, category, sla_due_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2::uuid, $3::uuid, 'S9 ' || $1, 'D', $4::"TicketCategory", now(), now())`,
      n,
      ws,
      authors[ws],
      category,
    );
  await ticket(DEFAULT_WORKSPACE_ID, 9001, 'BOOK_STATUS_PRODUCTION');
  await ticket(ACME, 1001, 'PRINTING_QUALITY');
  await ticket(ACME, 1002, 'ROYALTY_PAYMENTS');
  await ticket(ACME, 1003, null);
  await sql(
    `INSERT INTO ticket_drafts (id, workspace_id, author_id, voice_thread_id, category, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, gen_random_uuid(), 'ISBN_METADATA', now())`,
    ACME,
    authors[ACME],
  );
}

const keysOf = async (ws: string) =>
  (
    await db.$queryRawUnsafe<{ key: string }[]>(
      `SELECT key FROM ticket_categories WHERE workspace_id = $1::uuid ORDER BY position`,
      ws,
    )
  ).map((r) => r.key);

beforeAll(async () => {
  admin = createDb(inject('databaseUrl'));
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await admin.$executeRawUnsafe(`CREATE DATABASE ${DB_NAME}`);
  const u = new URL(inject('databaseUrl'));
  u.pathname = `/${DB_NAME}`;
  url = u.toString();
  work = mkdtempSync(join(tmpdir(), 's9-'));
  cpSync(join(apiRoot, 'prisma', 'schema.prisma'), join(work, 'schema.prisma'));
  stageMigrations(false);
  deploy();
  db = createDb(url);
  await populate();
  stageMigrations(true);
  deploy();
});
afterAll(async () => {
  await db?.$disconnect();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
  await admin.$disconnect();
  if (work) rmSync(work, { recursive: true, force: true });
});

describe('S.9 migration on existing tickets', () => {
  it('gives BookLeaf all six categories in triage order', async () => {
    expect(await keysOf(DEFAULT_WORKSPACE_ID)).toEqual([
      'ROYALTY_PAYMENTS',
      'ISBN_METADATA',
      'PRINTING_QUALITY',
      'DISTRIBUTION_AVAILABILITY',
      'BOOK_STATUS_PRODUCTION',
      'GENERAL_INQUIRY',
    ]);
  });

  it('gives other workspaces General Inquiry plus only the categories their data uses', async () => {
    expect(await keysOf(ACME)).toEqual([
      'ROYALTY_PAYMENTS',
      'ISBN_METADATA',
      'PRINTING_QUALITY',
      'GENERAL_INQUIRY',
    ]);
    expect(await keysOf(EMPTY)).toEqual(['GENERAL_INQUIRY']);
  });

  it('copies every category into category_key and leaves the old column untouched', async () => {
    const rows = await db.$queryRawUnsafe<
      { category: string | null; category_key: string | null }[]
    >(
      `SELECT category::text AS category, category_key FROM tickets WHERE subject LIKE 'S9 %' ORDER BY number`,
    );
    expect(rows).toEqual([
      { category: 'PRINTING_QUALITY', category_key: 'PRINTING_QUALITY' },
      { category: 'ROYALTY_PAYMENTS', category_key: 'ROYALTY_PAYMENTS' },
      { category: null, category_key: null },
      { category: 'BOOK_STATUS_PRODUCTION', category_key: 'BOOK_STATUS_PRODUCTION' },
    ]);
    const [draft] = await db.$queryRawUnsafe<{ category_key: string }[]>(
      `SELECT category_key FROM ticket_drafts WHERE workspace_id = $1::uuid`,
      ACME,
    );
    expect(draft?.category_key).toBe('ISBN_METADATA');
  });

  it("refuses a ticket pointing at a category its workspace doesn't have", async () => {
    await expect(
      sql(
        `UPDATE tickets SET category_key = 'DISTRIBUTION_AVAILABILITY' WHERE workspace_id = $1::uuid`,
        ACME,
      ),
    ).rejects.toThrow();
  });
});
