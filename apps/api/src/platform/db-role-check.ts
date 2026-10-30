import type { Db } from './db.js';
import { asPlatform } from './tenancy.js';

interface RoleFlags {
  name: string;
  bypasses: boolean;
}

export interface RoleCheckLog {
  warn(obj: object, msg: string): void;
}

const readFlags = async (db: Db): Promise<RoleFlags> => {
  const rows = await db.$queryRaw<RoleFlags[]>`
    SELECT rolname AS name, (rolsuper OR rolbypassrls) AS bypasses
    FROM pg_roles WHERE rolname = current_user`;
  const flags = rows[0];
  if (!flags) throw new Error('could not read the current Postgres role');
  return flags;
};

/** What is wrong with the two connections, if anything (S.8). */
export async function dbRoleProblems(db: Db): Promise<string[]> {
  const app = await readFlags(db);
  const admin = await asPlatform(() => readFlags(db));
  const problems: string[] = [];
  if (app.bypasses)
    problems.push(
      `DATABASE_URL connects as "${app.name}", which bypasses row-level security; use the restricted app role (pnpm db:roles)`,
    );
  if (!admin.bypasses)
    problems.push(
      `DATABASE_ADMIN_URL connects as "${admin.name}", which does not bypass row-level security; signup, sign-in and the worker need the owner (superuser or BYPASSRLS)`,
    );
  return problems;
}

/**
 * Checked when the API starts. In production a wrong role refuses to start (tenant isolation
 * would silently be off, or the platform paths would see nothing); elsewhere it warns.
 */
export async function checkDbRoles(db: Db, strict: boolean, log: RoleCheckLog): Promise<void> {
  const problems = await dbRoleProblems(db);
  if (problems.length === 0) return;
  if (strict) throw new Error(`Database roles are not set up: ${problems.join('; ')}`);
  for (const problem of problems) log.warn({ problem }, 'database roles: row-level security');
}
