#!/usr/bin/env node
// `npm run local` — one command from a fresh clone to a running app:
// check tools → .env → install → Postgres + Redis (Docker) → migrate → seed → start every app.
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETUP_SCRIPTS, START_SCRIPT, accounts, links } from './config.mjs';
import { ensureEnvFile } from './env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIN_NODE_MAJOR = 22;
const IS_WINDOWS = process.platform === 'win32';
const DB_WAIT_ATTEMPTS = 60;
const DB_WAIT_INTERVAL_MS = 1000;

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function step(title) {
  console.log(`\n▶ ${title}`);
}

function succeeds(cmd, args) {
  return spawnSync(cmd, args, { stdio: 'ignore', shell: IS_WINDOWS }).status === 0;
}

function run(cmd, args, what) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: IS_WINDOWS,
  });
  if (result.status !== 0)
    fail(`${what} failed. Fix the error above, then run \`npm run local\` again.`);
}

/**
 * On first start Postgres runs a temporary socket-only server while it initialises, so "healthy"
 * is not enough. Checking over TCP waits for the real server.
 */
function waitForDatabase() {
  const check = ['compose', 'exec', '-T', 'db', 'pg_isready', '-h', '127.0.0.1'];
  for (let attempt = 0; attempt < DB_WAIT_ATTEMPTS; attempt += 1) {
    const result = spawnSync('docker', check, { cwd: ROOT, stdio: 'ignore', shell: IS_WINDOWS });
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DB_WAIT_INTERVAL_MS);
  }
  fail('Postgres did not accept connections in time. Check `docker compose logs db`.');
}

/** Redis answers PING once it accepts commands; the API refuses to start before that. */
function waitForRedis() {
  const check = ['compose', 'exec', '-T', 'redis', 'redis-cli', 'ping'];
  for (let attempt = 0; attempt < DB_WAIT_ATTEMPTS; attempt += 1) {
    const result = spawnSync('docker', check, { cwd: ROOT, encoding: 'utf8', shell: IS_WINDOWS });
    if (result.status === 0 && result.stdout.includes('PONG')) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DB_WAIT_INTERVAL_MS);
  }
  fail('Redis did not answer in time. Check `docker compose logs redis`.');
}

/** pnpm runs the workspace; fall back to corepack (bundled with Node) when it is not installed. */
function findPnpm() {
  if (succeeds('pnpm', ['--version'])) return ['pnpm'];
  if (succeeds('corepack', ['pnpm', '--version'])) return ['corepack', 'pnpm'];
  return fail('pnpm is missing. Install it with `npm install -g pnpm` (or `corepack enable`).');
}

function checkTools() {
  step('Checking tools');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE_MAJOR)
    fail(`Node ${MIN_NODE_MAJOR}+ is required (found ${process.versions.node}).`);
  if (!succeeds('docker', ['--version']))
    fail('Docker is missing. Install Docker Desktop and start it.');
  if (!succeeds('docker', ['info']))
    fail('Docker is installed but not running. Start Docker Desktop and retry.');
  return findPnpm();
}

function prepareEnv() {
  step('Preparing .env');
  const { created, added } = ensureEnvFile(ROOT);
  if (created) console.log('  Created .env from .env.example with fresh random secrets.');
  else if (added.length > 0) console.log(`  Added missing settings to .env: ${added.join(', ')}`);
  else console.log('  .env is complete. Existing values are never changed.');
  process.loadEnvFile(resolve(ROOT, '.env'));
  // Point the web dev servers at the ports .env chose, so custom ports work without extra settings.
  process.env.API_PROXY_TARGET ??= `http://localhost:${process.env.PORT ?? '3000'}`;
  process.env.HOST_PROXY_TARGET ??= `http://localhost:${process.env.HOST_DEMO_PORT ?? '3200'}`;
}

function printReady() {
  const rows = links(process.env).map(([label, url]) => `  ${label.padEnd(40)} ${url}`);
  const logins = accounts(process.env).map(
    ([who, email, pass]) => `  ${who.padEnd(30)} ${email}  /  ${pass ?? '(see .env)'}`,
  );
  console.log(
    `\n✔ Ready once the apps below finish starting:\n${rows.join('\n')}\n\nDemo logins:\n${logins.join('\n')}`,
  );
  console.log(
    '\nAI keys are optional: without them the app uses its rule-based fallback. Stop with Ctrl+C.\n',
  );
}

function main() {
  const [pnpm, ...pnpmArgs] = checkTools();
  prepareEnv();
  step('Installing packages');
  run(pnpm, [...pnpmArgs, 'install', '--frozen-lockfile'], 'Installing packages');
  step('Starting Postgres and Redis in Docker');
  run(
    'docker',
    ['compose', 'up', '-d', '--wait', 'db', 'redis'],
    'Starting Postgres and Redis (if port 5433 or 6380 is already in use, stop the other service first)',
  );
  waitForDatabase();
  waitForRedis();
  for (const script of SETUP_SCRIPTS) {
    step(`Running ${script}`);
    run(pnpm, [...pnpmArgs, script], script);
  }
  printReady();
  const apps = spawn(pnpm, [...pnpmArgs, START_SCRIPT], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: IS_WINDOWS,
  });
  apps.on('exit', (code) => process.exit(code ?? 0));
}

main();
