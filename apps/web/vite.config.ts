import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/** Libraries in their own files: they change rarely, so browsers keep them across releases. */
const VENDOR_CHUNKS: Record<string, RegExp> = {
  react: /node_modules\/\.pnpm\/(react|react-dom|scheduler|react-router)@/,
  zod: /node_modules\/\.pnpm\/zod@/,
  query: /node_modules\/\.pnpm\/@tanstack\+/,
};

const vendorChunk = (id: string) =>
  Object.entries(VENDOR_CHUNKS).find(([, pattern]) => pattern.test(id))?.[0];

/** Dev server proxies /api to the API so cookies stay first-party (same origin in production too). */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.API_PROXY_TARGET ?? 'http://localhost:3000';
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy: { '/api': { target: apiTarget, changeOrigin: false, ws: true } } },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: { output: { manualChunks: vendorChunk } },
    },
  };
});
