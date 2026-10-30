import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb, type Db } from '../src/platform/db.js';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';

/**
 * U-9 migration on a populated database: a workspace with a saved single-endpoint connector gets
 * that endpoint as its first data source (same URL, fixed shape, its own timeout and cache); the
 * default workspace on env settings and workspaces without a connector get none; base_url stays.
 */
const U9 = '20261031010000_product_data_sources';
const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const DB_NAME = `u9_migration_${process.pid}`;
const ACME = '00000000-0000-4000-8000-00000000ac19';
const EMPTY = '00000000-0000-4000-8000-00000000e919';

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

/** The migrations folder up to (or, once `withU9`, including) U-9. */
function stageMigrations(withU9: boolean): void {
  const from = join(apiRoot, 'prisma', 'migrations');
  for (const name of readdirSync(from)) {
    if (name !== 'migration_lock.toml' && (withU9 ? name > U9 : name >= U9)) continue;
    cpSync(join(from, name), join(work, 'migrations', name), { recursive: true });
  }
}

const sql = (query: string, ...values: unknown[]) => db.$executeRawUnsafe(query, ...values);

async function populate(): Promise<void> {
  await sql(
    `INSERT INTO workspaces (id, slug, name, ticket_prefix, updated_at) VALUES
     ($1::uuid, 'acme-u9', 'Acme', 'AU9', now()), ($2::uuid, 'empty-u9', 'Empty', 'EU9', now())`,
    ACME,
    EMPTY,
  );
  await sql(
    `INSERT INTO workspace_connectors (id, workspace_id, base_url, api_key_enc, api_key_hint,
       signing_secret_enc, signing_secret_hint, timeout_ms, cache_seconds, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, 'https://api.acme.example/v2/', 'enc', '…1234', 'enc',
       '…5678', 2500, 30, now())`,
    ACME,
  );
  await sql(
    `INSERT INTO customer_fields (id, workspace_id, key, label, type, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, 'account.balance', 'Balance', 'MONEY', now())`,
    ACME,
  );
}

const sourcesOf = (ws: string) =>
  db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT name, url_template, format::text AS format, auth_header, timeout_ms, cache_seconds
     FROM workspace_data_sources WHERE workspace_id = $1::uuid`,
    ws,
  );

beforeAll(async () => {
  admin = createDb(inject('databaseAdminUrl'));
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await admin.$executeRawUnsafe(`CREATE DATABASE ${DB_NAME}`);
  const u = new URL(inject('databaseAdminUrl'));
  u.pathname = `/${DB_NAME}`;
  url = u.toString();
  work = mkdtempSync(join(tmpdir(), 'u9-'));
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

describe('U-9 migration on existing connectors', () => {
  it('turns a saved connector into its first data source, in the fixed customer shape', async () => {
    expect(await sourcesOf(ACME)).toEqual([
      {
        name: 'Customer',
        url_template: 'https://api.acme.example/v2/support/customers/{id}',
        format: 'CONTRACT',
        auth_header: null,
        timeout_ms: 2500,
        cache_seconds: 30,
      },
    ]);
  });

  it('adds nothing for the env-backed default workspace or a workspace without a connector', async () => {
    expect(await sourcesOf(DEFAULT_WORKSPACE_ID)).toEqual([]);
    expect(await sourcesOf(EMPTY)).toEqual([]);
  });

  it('keeps base_url and leaves existing fields unmapped', async () => {
    const [row] = await db.$queryRawUnsafe<{ base_url: string; record_mapping: unknown }[]>(
      `SELECT base_url, record_mapping FROM workspace_connectors WHERE workspace_id = $1::uuid`,
      ACME,
    );
    expect(row).toEqual({ base_url: 'https://api.acme.example/v2/', record_mapping: null });
    const fields = await db.$queryRawUnsafe<{ source_id: string | null; path: string | null }[]>(
      `SELECT source_id, path FROM customer_fields WHERE workspace_id = $1::uuid`,
      ACME,
    );
    expect(fields).toEqual([{ source_id: null, path: null }]);
  });

  it('is safe to run twice (idempotent backfill)', async () => {
    const backfill = `INSERT INTO workspace_data_sources (id, workspace_id, name, url_template,
        format, timeout_ms, cache_seconds, position, created_at, updated_at)
      SELECT gen_random_uuid(), c.workspace_id, 'Customer',
        rtrim(c.base_url, '/') || '/support/customers/{id}', 'CONTRACT', c.timeout_ms,
        c.cache_seconds, 0, now(), now()
      FROM workspace_connectors c WHERE c.base_url IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM workspace_data_sources s WHERE s.workspace_id = c.workspace_id)`;
    expect(await sql(backfill)).toBe(0);
    expect(await sourcesOf(ACME)).toHaveLength(1);
  });
});
