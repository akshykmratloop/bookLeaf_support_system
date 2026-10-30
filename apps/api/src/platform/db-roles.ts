import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

/**
 * The restricted Postgres role the API serves requests with (S.8). It owns nothing, cannot bypass
 * row-level security and may only read and write rows: no DDL, no migrations table. Its name and
 * password come from DATABASE_URL itself, so the env holds them once.
 */
export interface AppRole {
  name: string;
  password: string;
  schema: string;
}

/** Plain lower-case identifiers only, so they can be written into DDL without quoting tricks. */
const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const Identifier = z.string().regex(IDENTIFIER, 'must be a plain lower-case Postgres name');

const AppRoleSchema = z.object({
  name: Identifier,
  password: z.string().min(12, 'the app role password must be at least 12 characters').max(200),
  schema: Identifier,
});

/** Reads the app role from DATABASE_URL; it must be a different user from the owner URL's. */
export function appRoleFrom(appUrl: string, adminUrl: string): AppRole {
  const app = new URL(appUrl);
  const admin = new URL(adminUrl);
  const name = decodeURIComponent(app.username);
  if (name === decodeURIComponent(admin.username))
    throw new Error('DATABASE_URL must use the app role, not the owner user of DATABASE_ADMIN_URL');
  return AppRoleSchema.parse({
    name,
    password: decodeURIComponent(app.password),
    schema: app.searchParams.get('schema') ?? 'public',
  });
}

const quoteLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

async function isSuperuser(admin: PrismaClient): Promise<boolean> {
  const rows = await admin.$queryRaw<{ rolsuper: boolean }[]>`
    SELECT rolsuper FROM pg_roles WHERE rolname = current_user`;
  return rows[0]?.rolsuper === true;
}

async function createOrUpdateRole(admin: PrismaClient, role: AppRole): Promise<void> {
  const exists = await admin.$queryRaw<
    unknown[]
  >`SELECT 1 FROM pg_roles WHERE rolname = ${role.name}`;
  if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE ROLE "${role.name}" LOGIN`);
  // Only a superuser may set these flags; anyone else is checked afterwards instead.
  const flags = (await isSuperuser(admin)) ? 'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE' : '';
  await admin.$executeRawUnsafe(
    `ALTER ROLE "${role.name}" WITH LOGIN ${flags} PASSWORD ${quoteLiteral(role.password)}`,
  );
}

/** Row access on every tenant table, now and for tables later migrations create (as the owner). */
async function grantRowAccess(admin: PrismaClient, { name, schema }: AppRole): Promise<void> {
  const [db] = await admin.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!db) throw new Error('could not read the current database name');
  const statements = [
    `GRANT CONNECT ON DATABASE "${db.name.replaceAll('"', '""')}" TO "${name}"`,
    `GRANT USAGE ON SCHEMA "${schema}" TO "${name}"`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schema}" TO "${name}"`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO "${name}"`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${name}"`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT USAGE, SELECT ON SEQUENCES TO "${name}"`,
  ];
  for (const sql of statements) await admin.$executeRawUnsafe(sql);
  await revokeOwnerOnly(admin, { name, schema });
}

/**
 * Tables the app role must never touch, not even a row: migration history, and the platform
 * tables of the super admin console (U-7), which only the owner connection reads and writes.
 * Any new platform table must be added here (and revoked in its own migration).
 */
export const OWNER_ONLY_TABLES = [
  '_prisma_migrations',
  'platform_admins',
  'platform_settings',
  'platform_provider_keys',
  'workspace_plans',
] as const;

async function revokeOwnerOnly(admin: PrismaClient, { name, schema }: Omit<AppRole, 'password'>) {
  const present = await admin.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = ${schema}`;
  const names = new Set(present.map((t) => t.tablename));
  for (const table of OWNER_ONLY_TABLES)
    if (names.has(table))
      await admin.$executeRawUnsafe(`REVOKE ALL ON "${schema}"."${table}" FROM "${name}"`);
}

/** Refuses a role that could see past row-level security. */
async function assertRestricted(admin: PrismaClient, name: string): Promise<void> {
  const rows = await admin.$queryRaw<{ unsafe: boolean }[]>`
    SELECT (rolsuper OR rolbypassrls) AS unsafe FROM pg_roles WHERE rolname = ${name}`;
  if (rows[0]?.unsafe !== false)
    throw new Error(`Postgres role "${name}" can bypass row-level security; use a plain role`);
}

/**
 * Creates or updates the app role and its grants. Idempotent: safe on every deploy and every
 * `npm run local`, on an empty database (before migrations) and on a populated one.
 */
export async function ensureAppRole(admin: PrismaClient, role: AppRole): Promise<void> {
  await createOrUpdateRole(admin, role);
  await grantRowAccess(admin, role);
  await assertRestricted(admin, role.name);
}
