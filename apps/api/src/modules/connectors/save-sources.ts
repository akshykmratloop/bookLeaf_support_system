import type { DataSourceInputSchema, RecordMapping, SaveConnectorRequest } from '@bookleaf/shared';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { expandTemplate } from '../../host/sources/template.js';
import { assertSafeUrl, UnsafeUrlError } from '../../platform/net/ssrf.js';
import type { ConnectorDeps } from './deps.js';

export type SourceInput = z.output<typeof DataSourceInputSchema>;
export type FieldError = { path: string; message: string };

/** Throws only for unexpected errors; an unsafe or unresolvable address is a field error. */
export async function checkUrl(
  deps: ConnectorDeps,
  path: string,
  url: string | null | undefined,
): Promise<FieldError | null> {
  if (!url) return null;
  try {
    await assertSafeUrl(url, deps.ssrf);
    return null;
  } catch (err) {
    if (err instanceof UnsafeUrlError) return { path, message: err.message };
    throw err;
  }
}

/** The SSRF check on every source URL, with sample values filled into the placeholders. */
export async function checkSources(deps: ConnectorDeps, sources: SourceInput[]) {
  const sample = { id: 'sample-id', email: 'sample@example.com' };
  const checks = sources.map((s, i) =>
    checkUrl(deps, `sources.${i}.urlTemplate`, expandTemplate(s.urlTemplate, sample).toString()),
  );
  return (await Promise.all(checks)).filter((e): e is FieldError => e !== null);
}

const LEGACY_SUFFIX = '/support/customers/{id}';

/** What a save does to the sources: replace the list, or (older form) the fixed-shape one only. */
export type SourcesChange =
  | { kind: 'replace'; list: SourceInput[] }
  | { kind: 'contract'; source: SourceInput }
  | { kind: 'keep' };

/**
 * The older `baseUrl` form is the fixed-shape endpoint under that URL: it replaces only the
 * fixed-shape source and leaves mapped sources alone.
 */
export function requestedChange(input: SaveConnectorRequest): SourcesChange {
  if (input.sources) return { kind: 'replace', list: input.sources as SourceInput[] };
  if (!input.baseUrl) return { kind: 'keep' };
  const source: SourceInput = {
    name: 'Customer',
    urlTemplate: `${input.baseUrl.replace(/\/+$/, '')}${LEGACY_SUFFIX}`,
    format: 'CONTRACT',
    authHeader: null,
    timeoutMs: input.timeoutMs ?? 3000,
    cacheSeconds: input.cacheSeconds ?? 60,
  };
  return { kind: 'contract', source };
}

export const changedList = (c: SourcesChange): SourceInput[] =>
  c.kind === 'replace' ? c.list : c.kind === 'contract' ? [c.source] : [];

/** The older base_url column, kept meaningful while it exists (rollback reads it). */
export function legacyBaseUrl(sources: SourceInput[]): string | null {
  const contract = sources.find((s) => s.format === 'CONTRACT' && s.urlTemplate);
  return contract?.urlTemplate.endsWith(LEGACY_SUFFIX)
    ? contract.urlTemplate.slice(0, -LEGACY_SUFFIX.length)
    : null;
}

/** Drops mapping entries that point at a source that no longer exists. */
export function pruneMapping(mapping: RecordMapping, keep: Set<string>): RecordMapping {
  const ok = <T extends { sourceId: string } | null>(ref: T) =>
    ref && keep.has(ref.sourceId) ? ref : null;
  return { name: ok(mapping.name), email: ok(mapping.email), items: ok(mapping.items) };
}

/**
 * Makes the workspace's source rows match the list: known ids are updated (their field
 * mappings stay), new ones created, missing ones deleted (their fields become unmapped).
 */
async function replaceAll(tx: Prisma.TransactionClient, workspaceId: string, list: SourceInput[]) {
  const existing = await tx.workspaceDataSource.findMany({ where: { workspaceId } });
  const known = new Set(existing.map((s) => s.id));
  const kept = new Set<string>();
  for (const [position, { id, ...fields }] of list.entries()) {
    const row =
      id && known.has(id)
        ? await tx.workspaceDataSource.update({ where: { id }, data: { ...fields, position } })
        : await tx.workspaceDataSource.create({ data: { ...fields, position, workspaceId } });
    kept.add(row.id);
  }
  const gone = [...known].filter((id) => !kept.has(id));
  if (gone.length) {
    // Source and path together, so a field is either fully mapped or not mapped at all.
    await tx.customerField.updateMany({
      where: { workspaceId, sourceId: { in: gone } },
      data: { sourceId: null, path: null },
    });
    await tx.workspaceDataSource.deleteMany({ where: { id: { in: gone } } });
  }
  return kept;
}

/** Updates the fixed-shape source in place (or adds it first), keeping every other source. */
async function replaceContract(tx: Prisma.TransactionClient, workspaceId: string, s: SourceInput) {
  const existing = await tx.workspaceDataSource.findMany({ where: { workspaceId } });
  const contract = existing.find((e) => e.format === 'CONTRACT');
  if (contract) {
    await tx.workspaceDataSource.update({ where: { id: contract.id }, data: s });
  } else {
    await tx.workspaceDataSource.updateMany({
      where: { workspaceId },
      data: { position: { increment: 1 } },
    });
    await tx.workspaceDataSource.create({ data: { ...s, position: 0, workspaceId } });
  }
  return new Set(
    (await tx.workspaceDataSource.findMany({ where: { workspaceId } })).map((e) => e.id),
  );
}

/** Applies a change; returns the ids of the sources that remain (null = untouched). */
export function applySources(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  change: SourcesChange,
): Promise<Set<string>> | null {
  if (change.kind === 'replace') return replaceAll(tx, workspaceId, change.list);
  if (change.kind === 'contract') return replaceContract(tx, workspaceId, change.source);
  return null;
}
