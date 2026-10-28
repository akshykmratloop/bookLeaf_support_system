// Makes sure a usable .env exists before anything starts.
// - No .env yet: copy .env.example and replace every `replace-with-...` value with a random secret.
// - .env exists: never change a value; only append keys that .env.example has and .env lacks.
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY_LINE = /^([A-Z][A-Z0-9_]*)=(.*)$/;
const PLACEHOLDER_LINE = /^([A-Z][A-Z0-9_]*)=replace-with[^\n]*$/gm;

const randomSecret = () => randomBytes(48).toString('base64');

const fillPlaceholders = (text) =>
  text.replace(PLACEHOLDER_LINE, (_line, key) => `${key}=${randomSecret()}`);

function keysOf(text) {
  return new Set(
    text
      .split('\n')
      .map((line) => KEY_LINE.exec(line.trim())?.[1])
      .filter(Boolean),
  );
}

function missingLines(exampleText, existingKeys) {
  return exampleText.split('\n').filter((line) => {
    const key = KEY_LINE.exec(line.trim())?.[1];
    return key !== undefined && !existingKeys.has(key);
  });
}

/** @returns {{ created: boolean, added: string[] }} */
export function ensureEnvFile(root) {
  const examplePath = join(root, '.env.example');
  const envPath = join(root, '.env');
  const example = readFileSync(examplePath, 'utf8');

  if (!existsSync(envPath)) {
    writeFileSync(envPath, fillPlaceholders(example), { mode: 0o600 });
    return { created: true, added: [] };
  }

  const lines = missingLines(example, keysOf(readFileSync(envPath, 'utf8')));
  if (lines.length === 0) return { created: false, added: [] };

  const block = fillPlaceholders(lines.join('\n'));
  appendFileSync(envPath, `\n# Added by \`npm run local\` from .env.example\n${block}\n`);
  return { created: false, added: lines.map((line) => KEY_LINE.exec(line)[1]) };
}
