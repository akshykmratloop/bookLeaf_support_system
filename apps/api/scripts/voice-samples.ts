/**
 * Makes the voice preview samples once: one short MP3 per OpenAI voice, saved as static files of
 * the web app (apps/web/public/voice-samples/openai/<voice>.mp3) and shared by every customer.
 * Voices that already have a file are skipped, so running it again costs nothing.
 *
 *   pnpm --filter @bookleaf/api voice-samples            (needs OPENAI_API_KEY)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENAI_VOICE_SAMPLES } from '../src/voice/providers/openai/samples.js';

const WEB_PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/public');
const SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const MODEL = 'gpt-4o-mini-tts';
const SAMPLE_TEXT =
  "Hi, I'm your support assistant. I can check your account, answer your questions, and raise a ticket for you. How can I help today?";
const INSTRUCTIONS =
  'A friendly, clear support assistant on a phone call. Natural pace, warm tone.';
const ATTEMPTS = 4;
const RETRY_DELAY_MS = 3_000;

async function speak(apiKey: string, voice: string): Promise<Buffer> {
  const res = await fetch(SPEECH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      voice,
      input: SAMPLE_TEXT,
      instructions: INSTRUCTIONS,
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI speech failed for "${voice}" with HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function speakWithRetry(apiKey: string, voice: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await speak(apiKey, voice);
    } catch (err) {
      if (attempt >= ATTEMPTS) throw err;
      console.warn(`retry ${voice} (${attempt}/${ATTEMPTS - 1}): ${(err as Error).message}`);
      await new Promise((done) => setTimeout(done, RETRY_DELAY_MS * attempt));
    }
  }
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set: no samples were made.');
  process.exit(1);
}
for (const [voice, path] of Object.entries(OPENAI_VOICE_SAMPLES)) {
  const file = `${WEB_PUBLIC}${path}`;
  if (existsSync(file)) {
    console.log(`skip ${voice} (already made)`);
    continue;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await speakWithRetry(apiKey, voice));
  console.log(`made ${voice} → ${path}`);
}
