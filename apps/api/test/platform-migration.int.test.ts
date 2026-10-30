import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb, type Db } from '../src/platform/db.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';

/**
 * U-7 migration on a populated database: today's shared AI settings (with BookLeaf's own model
 * choices on top) become the platform settings, every workspace gets a plan that allows what it
 * has today, switched-on assistant defaults are kept, and AI runs of tickets get their workspace.
 * Nothing old is dropped (expand step).
 */
const U7 = '20261030140000_platform_console';
const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const DB_NAME = `u7_migration_${process.pid}`;
const ACME = '00000000-0000-4000-8000-00000000ac07';
const AUTHOR = '00000000-0000-4000-8000-0000000b0701';
const TICKET = '00000000-0000-4000-8000-0000000c0701';

let admin: Db;
let db: Db;
let work: string;
let url: string;

function deploy(): void {
  execFileSync(
    `${apiRoot}node_modules/.bin/prisma`,
    ['migrate', 'deploy', '--schema', join(work, 'schema.prisma')],
    { cwd: apiRoot, env: { ...process.env, DATABASE_ADMIN_URL: url }, stdio: 'pipe' },
  );
}

function stageMigrations(withU7: boolean): void {
  const from = join(apiRoot, 'prisma', 'migrations');
  for (const name of readdirSync(from)) {
    if (name !== 'migration_lock.toml' && (withU7 ? name > U7 : name >= U7)) continue;
    cpSync(join(from, name), join(work, 'migrations', name), { recursive: true });
  }
}

const sql = (query: string, ...values: unknown[]) => db.$executeRawUnsafe(query, ...values);

async function populate(): Promise<void> {
  await sql(`INSERT INTO ai_settings (id, provider, triage_model, draft_model, simulate_outage, updated_at)
             VALUES (1, 'anthropic', 'claude-haiku-5-5', 'claude-sonnet-5-5', false, now())
             ON CONFLICT (id) DO NOTHING`);
  await sql(`INSERT INTO assistant_settings (id, chat_enabled, voice_enabled, chat_model, updated_at)
             VALUES (1, true, false, 'claude-haiku-5-5', now())
             ON CONFLICT (id) DO UPDATE SET chat_enabled = true, voice_enabled = false`);
  await sql(
    `INSERT INTO workspace_settings (id, workspace_id, draft_model, chat_enabled, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, 'claude-opus-5-5', false, now())`,
    DEFAULT_WORKSPACE_ID,
  );
  await sql(
    `INSERT INTO workspaces (id, slug, name, ticket_prefix, updated_at) VALUES ($1::uuid, 'acme-u7', 'Acme', 'AU7', now())`,
    ACME,
  );
  await sql(
    `INSERT INTO users (id, workspace_id, email, name, role) VALUES ($1::uuid, $2::uuid, 'a@u7.example', 'A', 'AUTHOR')`,
    AUTHOR,
    DEFAULT_WORKSPACE_ID,
  );
  await sql(
    `INSERT INTO authors (id, workspace_id, external_id, user_id) VALUES ($1::uuid, $2::uuid, 'U7', $1::uuid)`,
    AUTHOR,
    DEFAULT_WORKSPACE_ID,
  );
  await sql(
    `INSERT INTO tickets (id, number, workspace_id, author_id, subject, description, sla_due_at, updated_at)
     VALUES ($1::uuid, 7001, $2::uuid, $3::uuid, 'U7', 'D', now(), now())`,
    TICKET,
    DEFAULT_WORKSPACE_ID,
    AUTHOR,
  );
  await sql(
    `INSERT INTO ai_runs (id, ticket_id, task, provider, model, latency_ms, outcome)
     VALUES (gen_random_uuid(), $1::uuid, 'TRIAGE', 'anthropic', 'claude-haiku-5-5', 5, 'OK'),
            (gen_random_uuid(), NULL, 'CHAT', 'anthropic', 'claude-haiku-5-5', 5, 'OK')`,
    TICKET,
  );
}

beforeAll(async () => {
  admin = createDb(inject('databaseAdminUrl'));
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await admin.$executeRawUnsafe(`CREATE DATABASE ${DB_NAME}`);
  const u = new URL(inject('databaseAdminUrl'));
  u.pathname = `/${DB_NAME}`;
  url = u.toString();
  work = mkdtempSync(join(tmpdir(), 'u7-'));
  mkdirSync(join(work, 'migrations'));
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

describe('U-7 migration on a populated database', () => {
  it('makes the shared settings, with BookLeaf’s own model choice on top, the platform settings', async () => {
    expect(await db.platformSettings.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({
      provider: 'anthropic',
      triageModel: 'claude-haiku-5-5',
      draftModel: 'claude-opus-5-5',
      chatModel: 'claude-haiku-5-5',
      simulateOutage: false,
    });
  });

  it('gives every workspace a plan that allows what it has today', async () => {
    const plans = await db.workspacePlan.findMany({ orderBy: { workspaceId: 'asc' } });
    expect(plans.map((p) => p.workspaceId).sort()).toEqual([DEFAULT_WORKSPACE_ID, ACME].sort());
    for (const p of plans)
      expect(p).toMatchObject({
        chatAllowed: true,
        voiceAllowed: true,
        aiEnabled: true,
        suspendedAt: null,
      });
  });

  it('keeps the switched-on chat default for a workspace without its own row, and BookLeaf’s row as it was', async () => {
    const acme = await db.workspaceSettings.findUniqueOrThrow({ where: { workspaceId: ACME } });
    expect(acme).toMatchObject({ chatEnabled: true, voiceEnabled: false });
    const bl = await db.workspaceSettings.findUniqueOrThrow({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
    });
    expect(bl).toMatchObject({
      chatEnabled: false,
      draftModel: 'claude-opus-5-5',
      replyLanguage: null,
    });
  });

  it('attributes ticket AI runs to their workspace and leaves the legacy tables in place', async () => {
    const runs = await db.aiRun.findMany({ orderBy: { task: 'asc' } });
    expect(runs.map((r) => [r.task, r.workspaceId])).toEqual([
      ['CHAT', null],
      ['TRIAGE', DEFAULT_WORKSPACE_ID],
    ]);
    expect(await db.aiSettings.count()).toBe(1);
    expect(await db.assistantSettings.count()).toBe(1);
  });
});
