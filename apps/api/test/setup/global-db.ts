import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { createDb } from '../../src/platform/db.js';
import { seedCore } from '../../src/seed/seed-core.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export const TEST_AUTHOR_PASSWORD = 'Author@Test1';
export const TEST_ADMIN_PASSWORD = 'Admin@Test1';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
let container: StartedPostgreSqlContainer | undefined;

/** Real Postgres per test run: migrations from the repo, then the provided dataset. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  execFileSync(`${apiRoot}node_modules/.bin/prisma`, ['migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  const db = createDb(url);
  const data: unknown = JSON.parse(
    readFileSync(`${apiRoot}prisma/seed-data/bookleaf_sample_data.json`, 'utf8'),
  );
  await seedCore(db, data, {
    authorPassword: TEST_AUTHOR_PASSWORD,
    adminPassword: TEST_ADMIN_PASSWORD,
  });
  await db.$disconnect();
  project.provide('databaseUrl', url);
  return async () => {
    await container?.stop();
  };
}
