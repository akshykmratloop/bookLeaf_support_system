import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { createDb, type Db } from '../src/platform/db.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';

/**
 * F-13 migration on a populated database: the tickets were numbered by one global sequence
 * (label BL-(1000 + n)). BookLeaf keeps every label; other workspaces renumber from 1001 in
 * created_at order; every counter ends at max + 1.
 */
const F13 = '20261030110000_ticket_numbers_per_workspace';
const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const DB_NAME = `f13_migration_${process.pid}`;
const ACME = '00000000-0000-4000-8000-00000000ac01';
const LAGOON = '00000000-0000-4000-8000-00000000b1a6';

let admin: Db;
let db: Db;
let work: string;
let url: string;

function deploy(): void {
  execFileSync(
    `${apiRoot}node_modules/.bin/prisma`,
    ['migrate', 'deploy', '--schema', join(work, 'schema.prisma')],
    {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    },
  );
}

/** The migrations folder as it was before F-13 (or with it, once `withF13`). */
function stageMigrations(withF13: boolean): void {
  const from = join(apiRoot, 'prisma', 'migrations');
  for (const name of readdirSync(from)) {
    if (name === F13 && !withF13) continue;
    cpSync(join(from, name), join(work, 'migrations', name), { recursive: true });
  }
}

async function author(workspaceId: string, userId: string, key: string): Promise<string> {
  await db.$executeRawUnsafe(
    `INSERT INTO users (id, workspace_id, email, name, role) VALUES ($1::uuid, $2::uuid, $3, 'A', 'AUTHOR')`,
    userId,
    workspaceId,
    `${key}@example.com`,
  );
  await db.$executeRawUnsafe(
    `INSERT INTO authors (id, workspace_id, external_id, user_id) VALUES ($1::uuid, $2::uuid, $3, $1::uuid)`,
    userId,
    workspaceId,
    key,
  );
  return userId;
}

/** Inserted in this order, so the old global sequence gives numbers 1, 2, 3, 4. */
async function ticket(workspaceId: string, authorId: string, createdAt: string): Promise<void> {
  await db.$executeRawUnsafe(
    `INSERT INTO tickets (id, workspace_id, author_id, subject, description, sla_due_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'S', 'D', now(), $3::timestamptz, now())`,
    workspaceId,
    authorId,
    createdAt,
  );
}

async function populate(): Promise<void> {
  await db.$executeRawUnsafe(
    `INSERT INTO workspaces (id, slug, name, created_at, updated_at) VALUES
     ($1::uuid, 'acme-mig', 'Acme Corp', '2026-01-02', now()),
     ($2::uuid, 'lagoon-mig', 'Blue Lagoon', '2020-01-01', now())`,
    ACME,
    LAGOON,
  );
  const bl = await author(DEFAULT_WORKSPACE_ID, '00000000-0000-4000-8000-0000000a0b01', 'bl');
  const ac = await author(ACME, '00000000-0000-4000-8000-0000000a0ac1', 'ac');
  await ticket(DEFAULT_WORKSPACE_ID, bl, '2026-02-01'); // 1 → stays BL-1001
  await ticket(ACME, ac, '2026-02-05'); // 2 → Acme's second (created later)
  await ticket(DEFAULT_WORKSPACE_ID, bl, '2026-02-02'); // 3 → stays BL-1003
  await ticket(ACME, ac, '2026-02-03'); // 4 → Acme's first
}

const numbers = async (workspaceId: string) =>
  (
    await db.$queryRawUnsafe<{ number: number }[]>(
      `SELECT number FROM tickets WHERE workspace_id = $1::uuid ORDER BY created_at`,
      workspaceId,
    )
  ).map((r) => r.number);

const workspace = async (id: string) =>
  (
    await db.$queryRawUnsafe<{ ticket_prefix: string; next_ticket_number: number }[]>(
      `SELECT ticket_prefix, next_ticket_number FROM workspaces WHERE id = $1::uuid`,
      id,
    )
  )[0];

beforeAll(async () => {
  admin = createDb(inject('databaseUrl'));
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await admin.$executeRawUnsafe(`CREATE DATABASE ${DB_NAME}`);
  const u = new URL(inject('databaseUrl'));
  u.pathname = `/${DB_NAME}`;
  url = u.toString();
  work = mkdtempSync(join(tmpdir(), 'f13-'));
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

describe('F-13 migration on existing tickets', () => {
  it("keeps BookLeaf's labels (BL-1001, BL-1003) and sets its counter to max + 1", async () => {
    expect(await numbers(DEFAULT_WORKSPACE_ID)).toEqual([1001, 1003]);
    expect(await workspace(DEFAULT_WORKSPACE_ID)).toEqual({
      ticket_prefix: 'BL',
      next_ticket_number: 1004,
    });
  });

  it('renumbers other workspaces from 1001 in created_at order', async () => {
    expect(await numbers(ACME)).toEqual([1001, 1002]);
    expect(await workspace(ACME)).toEqual({ ticket_prefix: 'AC', next_ticket_number: 1003 });
  });

  it('gives BookLeaf BL first and a workspace with no tickets a counter of 1001', async () => {
    expect(await workspace(LAGOON)).toEqual({ ticket_prefix: 'BL2', next_ticket_number: 1001 });
  });

  it('enforces one number per workspace and one prefix per platform', async () => {
    await expect(
      db.$executeRawUnsafe(`UPDATE workspaces SET ticket_prefix = 'BL' WHERE id = $1::uuid`, ACME),
    ).rejects.toThrow();
    await expect(
      db.$executeRawUnsafe(
        `UPDATE tickets SET number = 1001 WHERE workspace_id = $1::uuid AND number = 1002`,
        ACME,
      ),
    ).rejects.toThrow();
  });
});
