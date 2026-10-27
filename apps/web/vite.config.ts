import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/** Dev server proxies /api to the API so cookies stay first-party (same origin in production too). */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.API_PROXY_TARGET ?? 'http://localhost:3000';
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy: { '/api': { target: apiTarget, changeOrigin: false, ws: true } } },
    build: { outDir: 'dist', sourcemap: false },
  };
});
