import { createHash } from 'node:crypto';
import type { CustomerField } from '@prisma/client';
import type { FieldSpec, SourcesConfig } from '../../host/sources/types.js';
import { assertSafeUrl } from '../../platform/net/ssrf.js';
import { pinnedFetch } from '../../platform/net/pinned-fetch.js';
import { withWorkspace } from '../../platform/tenancy.js';
import type { ConnectorDeps } from './deps.js';
import { resolveConnector } from './store.js';

const toFieldSpec = (f: CustomerField): FieldSpec => ({
  key: f.key,
  label: f.label,
  type: f.type,
  allowedValues: f.allowedValues,
  visibleToCustomer: f.visibleToCustomer,
  sourceId: f.sourceId,
  path: f.path,
});

/** Changes whenever a field is added, changed or removed, so mappings apply at once. */
const stampOf = (fields: CustomerField[]) =>
  createHash('sha256')
    .update(fields.map((f) => `${f.id}:${f.updatedAt.getTime()}`).join(','))
    .digest('base64url')
    .slice(0, 16);

/** The email support knows for a customer (from their sign-in), for `{email}` URLs. */
function emailLookup(deps: ConnectorDeps, workspaceId: string) {
  return async (externalId: string): Promise<string | null> => {
    const author = await withWorkspace(workspaceId, () =>
      deps.db.author.findFirst({
        where: { workspaceId, externalId },
        select: { user: { select: { email: true } } },
      }),
    );
    return author?.user.email ?? null;
  };
}

/**
 * Everything the sources engine needs for one workspace, and a version that changes on every
 * save of the connection, its sources, its mapping or its fields. Null = no connection.
 * Read as that workspace, whoever asks first (S.8).
 */
export async function sourcesConfigFor(
  deps: ConnectorDeps,
  workspaceId: string,
): Promise<{ config: SourcesConfig; version: string } | null> {
  const [r, fields] = await withWorkspace(workspaceId, () =>
    Promise.all([
      resolveConnector(deps, workspaceId),
      deps.db.customerField.findMany({ where: { workspaceId }, orderBy: { position: 'asc' } }),
    ]),
  );
  if (!r.config) return null;
  const row = r.row ? `${r.row.version}:${r.row.updatedAt.getTime()}` : 'env';
  // A tenant's own URLs are checked again at every request; env settings are the operator's.
  const checkUrl = r.row
    ? async (url: URL) => void (await assertSafeUrl(url.toString(), deps.ssrf))
    : undefined;
  const config: SourcesConfig = {
    sources: r.config.sources,
    mapping: { record: r.config.record, fields: fields.map(toFieldSpec) },
    apiKey: r.config.apiKey,
    checkUrl,
    ...(r.row ? { fetch: pinnedFetch(deps.ssrf) } : {}),
    emailOf: emailLookup(deps, workspaceId),
  };
  return { config, version: `${row}:${stampOf(fields)}` };
}
