import type { SourceResult, SourceSpec, SourcesConfig } from './types.js';

/** A product answer larger than this is refused rather than read into memory. */
const MAX_BYTES = 1_000_000;

export interface Fetched {
  result: SourceResult;
  /** The body as text (cut at MAX_BYTES), for the Test panel; null when nothing came back. */
  text: string | null;
  durationMs: number;
}

function headersFor(spec: SourceSpec, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (spec.authHeader) headers[spec.authHeader] = apiKey;
  else headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

/** Reads at most MAX_BYTES of the body; a larger one is cancelled and reported. */
async function readCapped(res: Response): Promise<{ text: string; tooLarge: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) return { text: '', tooLarge: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return { text: Buffer.concat(chunks).toString('utf8'), tooLarge: true };
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks).toString('utf8'), tooLarge: false };
}

const parseJson = (text: string): { ok: true; json: unknown } | { ok: false } => {
  try {
    return { ok: true, json: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
};

function interpret(status: number, body: { text: string; tooLarge: boolean }): SourceResult {
  if (status < 200 || status > 299) return { ok: false, status, reason: `status ${status}` };
  if (body.tooLarge) return { ok: false, status, reason: 'the answer is larger than 1 MB' };
  const parsed = parseJson(body.text);
  if (!parsed.ok) return { ok: false, status, reason: 'the answer is not JSON' };
  return { ok: true, status, json: parsed.json };
}

/**
 * One GET to one source: its own timeout, no redirects (a redirect could lead to an internal
 * address), the address re-checked first when `checkUrl` is given. Never throws: a failure is a
 * result, so the other sources' fields can still be shown.
 */
export async function fetchSource(
  spec: SourceSpec,
  url: URL,
  apiKey: string,
  guard: Pick<SourcesConfig, 'checkUrl' | 'fetch'> = {},
): Promise<Fetched> {
  const { checkUrl, fetch: fetchImpl = fetch } = guard;
  // A duration only, not a point in time: the monotonic timer, not the clock.
  const started = performance.now();
  const took = () => Math.round(performance.now() - started);
  try {
    await checkUrl?.(url);
    const res = await fetchImpl(url, {
      headers: headersFor(spec, apiKey),
      redirect: 'error',
      signal: AbortSignal.timeout(spec.timeoutMs),
    });
    const body = await readCapped(res);
    return { result: interpret(res.status, body), text: body.text || null, durationMs: took() };
  } catch (err) {
    const reason = err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'no answer';
    const detail = err instanceof Error && err.name === 'UnsafeUrlError' ? err.message : reason;
    return { result: { ok: false, status: null, reason: detail }, text: null, durationMs: took() };
  }
}
