import { z } from 'zod';
import { usesSeparateRoles } from '../src/config/database.js';
import { createDb } from '../src/platform/db.js';
import { appRoleFrom, ensureAppRole } from '../src/platform/db-roles.js';

/**
 * Creates or updates the restricted app role the API serves requests with (S.8), from the user
 * and password in DATABASE_URL, connecting as the owner (DATABASE_ADMIN_URL). Idempotent: every
 * deploy (`node dist/db-roles.js`) and every `npm run local` (`pnpm db:roles`) runs it.
 */
const RolesEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().startsWith('postgres'),
  DATABASE_ADMIN_URL: z.string().startsWith('postgres'),
});

const LEGACY_ENV =
  'DATABASE_URL still uses the owner, so row-level security is not enforced here. Copy the two ' +
  'DATABASE_* lines from .env.example into .env to run requests on the restricted app role.';

async function main(): Promise<void> {
  const env = RolesEnvSchema.parse(process.env);
  // An older local .env (one URL for both): keep `npm run local` working, but say so.
  if (!usesSeparateRoles(env) && env.NODE_ENV !== 'production') {
    console.warn(`Skipping the app role: ${LEGACY_ENV}`);
    return;
  }
  const role = appRoleFrom(env.DATABASE_URL, env.DATABASE_ADMIN_URL);
  const admin = createDb(env.DATABASE_ADMIN_URL);
  try {
    await ensureAppRole(admin, role);
    console.log(`App role "${role.name}" is ready (row access only, row-level security applies).`);
  } finally {
    await admin.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Setting up the app role failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
