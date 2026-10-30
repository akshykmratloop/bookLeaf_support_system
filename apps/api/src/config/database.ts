import { z } from 'zod';

/**
 * The support module's own Postgres database, reached as two roles (S.8):
 * - DATABASE_URL: the restricted app role (no BYPASSRLS). Every request runs on it, under
 *   row-level security for the request's workspace.
 * - DATABASE_ADMIN_URL: the owner. Migrations, the seed, signup, sign-in lookups, the AI worker
 *   and the webhook sender. `pnpm db:roles` (deploy: `node dist/db-roles.js`) creates the app role.
 */
export const DatabaseConfig = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
  DATABASE_ADMIN_URL: z.string().startsWith('postgres'),
});

const userOf = (url: string): string => {
  try {
    return decodeURIComponent(new URL(url).username);
  } catch {
    return url;
  }
};

/** The two URLs must name different users, or row-level security protects nothing. */
export const usesSeparateRoles = (env: { DATABASE_URL: string; DATABASE_ADMIN_URL: string }) =>
  userOf(env.DATABASE_URL) !== userOf(env.DATABASE_ADMIN_URL);
