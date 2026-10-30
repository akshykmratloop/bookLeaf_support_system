import { defineConfig } from 'tsup';

/** One ESM bundle for production. The shared workspace package is TypeScript source, so it is bundled in. */
export default defineConfig({
  // seed and db-roles run on a deployed box (`node dist/seed.js`, `node dist/db-roles.js`), where
  // tsx and TypeScript are not installed.
  entry: {
    server: 'src/server.ts',
    index: 'src/index.ts',
    seed: 'prisma/seed.ts',
    'db-roles': 'prisma/db-roles.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@bookleaf/shared'],
});
