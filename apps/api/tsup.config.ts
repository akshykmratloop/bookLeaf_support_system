import { defineConfig } from 'tsup';

/** One ESM bundle for production. The shared workspace package is TypeScript source, so it is bundled in. */
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@bookleaf/shared'],
});
