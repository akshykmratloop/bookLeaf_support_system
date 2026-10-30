import type { MappedPreview, SourceProbe } from '@bookleaf/shared';
import { CustomerNotFoundError, HostUnavailableError } from '../errors.js';
import { ttlCache } from '../http/cache.js';
import type { HostRecords } from '../types.js';
import { buildCustomer } from './build.js';
import { fetchSource, type Fetched } from './fetch.js';
import { expandTemplate, MissingEmailError, needsEmail } from './template.js';
import type { SourceResult, SourcesConfig, SourceSpec } from './types.js';

/** "." and ".." would turn into a different path once put in the URL. */
const isPathLike = (id: string) => id === '.' || id === '..';
const RAW_LIMIT = 20_000;

/** Only the sources something reads: the fixed-shape one and every source a mapping points at. */
export function neededSources(config: SourcesConfig): SourceSpec[] {
  const { record, fields } = config.mapping;
  const ids = new Set<string>(
    config.sources.filter((s) => s.format === 'CONTRACT').map((s) => s.id),
  );
  for (const ref of [record.name, record.email, record.items]) if (ref) ids.add(ref.sourceId);
  for (const f of fields) if (f.sourceId && f.path) ids.add(f.sourceId);
  return config.sources.filter((s) => ids.has(s.id));
}

async function fetchOne(
  config: SourcesConfig,
  spec: SourceSpec,
  id: string,
  email: string | null,
): Promise<Fetched> {
  let url: URL;
  try {
    url = expandTemplate(spec.urlTemplate, { id, email });
  } catch (err) {
    if (!(err instanceof MissingEmailError)) throw err;
    return { result: { ok: false, status: null, reason: err.message }, text: null, durationMs: 0 };
  }
  return fetchSource(spec, url, config.apiKey, config.checkUrl);
}

const emailFor = async (config: SourcesConfig, sources: SourceSpec[], id: string) =>
  sources.some((s) => needsEmail(s.urlTemplate)) ? ((await config.emailOf?.(id)) ?? null) : null;

/**
 * HostRecords over one to five data sources: the needed sources are called in parallel, each
 * with its own timeout and cache (successes only), and merged into one customer record.
 */
export function sourcesHostRecords(config: SourcesConfig, now: () => number): HostRecords {
  const needed = neededSources(config);
  const caches = new Map(
    needed.map((s) => [s.id, ttlCache<SourceResult>(s.cacheSeconds * 1000, now)]),
  );
  const cached = async (spec: SourceSpec, id: string, email: string | null) => {
    const cache = caches.get(spec.id);
    const key = `${id}\n${email ?? ''}`;
    const hit = cache?.get(key);
    if (hit) return hit;
    const { result } = await fetchOne(config, spec, id, email);
    if (result.ok) cache?.set(key, result);
    return result;
  };
  return {
    async customer(externalId) {
      if (isPathLike(externalId)) throw new CustomerNotFoundError();
      const email = await emailFor(config, needed, externalId);
      const answers = await Promise.all(
        needed.map(async (s) => [s.id, await cached(s, externalId, email)] as const),
      );
      const built = buildCustomer({ ...config, externalId, results: new Map(answers) });
      return built.customer;
    },
  };
}

function rawOf(f: Fetched): string | null {
  if (f.result.ok) return JSON.stringify(f.result.json, null, 2).slice(0, RAW_LIMIT);
  return f.text ? f.text.slice(0, RAW_LIMIT) : null;
}

const probeOf = (s: SourceSpec, f: Fetched): SourceProbe => ({
  sourceId: s.id,
  name: s.name,
  ok: f.result.ok,
  status: f.result.status,
  detail: f.result.ok ? `Answered in ${f.durationMs} ms` : f.result.reason,
  durationMs: f.durationMs,
  raw: rawOf(f),
});

function previewOf(
  config: SourcesConfig,
  externalId: string,
  results: Map<string, SourceResult>,
): MappedPreview {
  try {
    return buildCustomer({ ...config, externalId, results });
  } catch (err) {
    if (err instanceof HostUnavailableError || err instanceof CustomerNotFoundError)
      return { customer: null, unavailable: [{ key: 'record', reason: err.message }] };
    throw err;
  }
}

/** The Test button: every source called once (no cache), raw answers and the merged preview. */
export async function probeSources(
  config: SourcesConfig,
  externalId: string,
  email: string | null,
) {
  if (isPathLike(externalId)) throw new CustomerNotFoundError();
  const mail = email ?? (await emailFor(config, config.sources, externalId));
  const fetched = await Promise.all(
    config.sources.map((s) => fetchOne(config, s, externalId, mail)),
  );
  const results = new Map(config.sources.map((s, i) => [s.id, fetched[i]!.result] as const));
  return {
    sources: config.sources.map((s, i) => probeOf(s, fetched[i]!)),
    preview: previewOf(config, externalId, results),
  };
}
