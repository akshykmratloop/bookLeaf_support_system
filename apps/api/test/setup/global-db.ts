import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';
import { createDb } from '../../src/platform/db.js';
import { appRoleFrom, ensureAppRole } from '../../src/platform/db-roles.js';
import { seedCore } from '../../src/seed/seed-core.js';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The restricted app role (S.8): what the API serves requests with. */
    databaseUrl: string;
    /** The owner: migrations, seed, and tests' own setup and checks. */
    databaseAdminUrl: string;
    redisUrl: string;
  }
}

export const TEST_ADMIN_PASSWORD = 'Admin@Test1';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
let container: StartedPostgreSqlContainer | undefined;
let redis: StartedRedisContainer | undefined;

/** The same database as the restricted app role (created below, like `pnpm db:roles`). */
function appUrlOf(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = 'bookleaf_app';
  url.password = randomBytes(18).toString('hex');
  return url.toString();
}

/**
 * Real Postgres and Redis per test run: migrations from the repo as the owner, the restricted app
 * role (S.8), then the support team's admins. Each harness uses its own Redis key prefix unless a
 * test shares one on purpose.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  [container, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);
  const adminUrl = container.getConnectionUri();
  const appUrl = appUrlOf(adminUrl);
  execFileSync(`${apiRoot}node_modules/.bin/prisma`, ['migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_ADMIN_URL: adminUrl },
    stdio: 'pipe',
  });
  const db = createDb(adminUrl);
  await ensureAppRole(db, appRoleFrom(appUrl, adminUrl));
  // Admins only: authors and books come from the demo host when each test signs them in.
  await seedCore(db, TEST_ADMIN_PASSWORD);
  await db.$disconnect();
  project.provide('databaseUrl', appUrl);
  project.provide('databaseAdminUrl', adminUrl);
  project.provide('redisUrl', redis.getConnectionUrl());
  return async () => {
    await Promise.all([container?.stop(), redis?.stop()]);
  };
}
