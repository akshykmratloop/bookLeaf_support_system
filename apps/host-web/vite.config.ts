import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/** BookLeaf's server (apps/host-demo) owns sign-in and data; the dev server proxies to it. */
const SERVER_PATHS = ['/api', '/login', '/logout', '/me', '/support-token'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.HOST_PROXY_TARGET ?? 'http://localhost:3200';
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      proxy: Object.fromEntries(SERVER_PATHS.map((p) => [p, { target, changeOrigin: false }])),
    },
    build: { outDir: 'dist', sourcemap: false },
  };
});
