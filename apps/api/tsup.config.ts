import { defineConfig } from 'tsup';

/** One ESM bundle for production. The shared workspace package is TypeScript source, so it is bundled in. */
export default defineConfig({
  // seed: run once on a deployed box (`node dist/seed.js`), where tsx and TypeScript are not installed.
  entry: { server: 'src/server.ts', index: 'src/index.ts', seed: 'prisma/seed.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@bookleaf/shared'],
});
