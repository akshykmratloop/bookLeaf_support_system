#!/usr/bin/env node
// `npm run local` — one command from a fresh clone to a running app:
// check tools → .env → install → Postgres (Docker) → migrate → seed → start every app.
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETUP_SCRIPTS, START_SCRIPT, accounts, links } from './config.mjs';
import { ensureEnvFile } from './env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIN_NODE_MAJOR = 22;
const IS_WINDOWS = process.platform === 'win32';

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
  step('Starting Postgres in Docker');
  run('docker', ['compose', 'up', '-d', '--wait', 'db'], 'Starting Postgres');
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
