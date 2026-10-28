// What `npm run local` starts on this branch, and what it prints when ready.
// Values come from .env at run time, so changing a port or password there is enough.

/** Root package.json scripts run in order before the apps start. */
export const SETUP_SCRIPTS = ['db:migrate', 'db:seed'];

/** Root package.json script that starts every app in watch mode. */
export const START_SCRIPT = 'dev';

/** @param {NodeJS.ProcessEnv} env */
export function links(env) {
  const apiPort = env.PORT ?? '3000';
  return [
    ['BookLeaf author dashboard (start here)', 'http://localhost:5174'],
    ['Support app — staff sign-in', 'http://localhost:5173/login'],
    ['API docs (Swagger)', `http://localhost:${apiPort}/api/docs`],
  ];
}

/** @param {NodeJS.ProcessEnv} env */
export function accounts(env) {
  return [
    ['Author (BookLeaf dashboard)', 'priya.sharma@email.com', env.HOST_DEMO_PASSWORD],
    ['Support admin (support app)', 'admin@bookleaf.demo', env.SEED_ADMIN_PASSWORD],
  ];
}
