import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';
import { createDb } from '../../src/platform/db.js';
import { seedCore } from '../../src/seed/seed-core.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
  }
}

export const TEST_ADMIN_PASSWORD = 'Admin@Test1';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
let container: StartedPostgreSqlContainer | undefined;
let redis: StartedRedisContainer | undefined;

/**
 * Real Postgres and Redis per test run: migrations from the repo, then the support team's
 * admins. Each harness uses its own Redis key prefix unless a test shares one on purpose.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  [container, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);
  const url = container.getConnectionUri();
  execFileSync(`${apiRoot}node_modules/.bin/prisma`, ['migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  const db = createDb(url);
  // Admins only: authors and books come from the demo host when each test signs them in.
  await seedCore(db, TEST_ADMIN_PASSWORD);
  await db.$disconnect();
  project.provide('databaseUrl', url);
  project.provide('redisUrl', redis.getConnectionUrl());
  return async () => {
    await Promise.all([container?.stop(), redis?.stop()]);
  };
}
