import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      { test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node' } },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.int.test.ts'],
          environment: 'node',
          globalSetup: ['test/setup/global-db.ts'],
          // Generous: on a loaded machine one request can stall for many seconds.
          testTimeout: 120_000,
          hookTimeout: 300_000,
        },
      },
    ],
  },
});
