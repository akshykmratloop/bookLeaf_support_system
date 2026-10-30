import type {
  Connector,
  ConnectorTestResult,
  MappedPreview,
  SaveConnectorRequest,
  SaveRecordMappingRequestSchema,
} from '@bookleaf/shared';
import type { WorkspaceConnector } from '@prisma/client';
import type { z } from 'zod';
import { probeSources } from '../../host/sources/records.js';
import { workspaceHostRecords, type WorkspaceHostSource } from '../../host/workspaces.js';
import { withWorkspace } from '../../platform/tenancy.js';
import type { Session } from '../auth/session.js';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/constants.js';
import type { ConnectorDeps } from './deps.js';
import { saveRecordMapping } from './mapping.js';
import { saveConnector } from './save.js';
import { sourcesConfigFor } from './sources-config.js';
import { resolveConnector, type Resolved } from './store.js';

const hint = (value: string, at: Date) => ({ hint: value, updatedAt: at.toISOString() });

function lastTestOf(row: WorkspaceConnector | null): Connector['lastTest'] {
  if (!row?.lastTestAt || row.lastTestOk === null) return null;
  return { ok: row.lastTestOk, at: row.lastTestAt.toISOString(), detail: row.lastTestDetail ?? '' };
}

const ENV_HINT = '(from env)';

/** Secret hints: the stored last-4, "(from env)" for the seeded default, or none. */
function hints(r: Resolved): Pick<Connector, 'apiKey' | 'signingSecret'> {
  if (r.row) {
    const at = r.row.updatedAt;
    return { apiKey: hint(r.row.apiKeyHint, at), signingSecret: hint(r.row.signingSecretHint, at) };
  }
  if (r.config) {
    const at = new Date(0);
    return { apiKey: hint(ENV_HINT, at), signingSecret: hint(ENV_HINT, at) };
  }
  return { apiKey: null, signingSecret: null };
}

const EMPTY = { baseUrl: null, signInUrl: null, timeoutMs: 3000, cacheSeconds: 60, sources: [] };

/** The connector as the UI sees it: URLs, sources, mapping, secret hints; never a secret. */
function toDto(r: Resolved): Connector {
  const c = r.config ?? { ...EMPTY, record: { name: null, email: null, items: null } };
  return {
    configured: r.source !== 'NONE',
    source: r.source,
    baseUrl: c.baseUrl,
    signInUrl: c.signInUrl,
    sources: c.sources,
    mapping: c.record,
    ...hints(r),
    timeoutMs: c.timeoutMs,
    cacheSeconds: c.cacheSeconds,
    lastTest: lastTestOf(r.row),
    version: r.row?.version ?? 0,
  };
}

/** The Test result as the admin reads it: one line, plus each source's answer and the preview. */
function summary(
  preview: MappedPreview,
): Pick<ConnectorTestResult, 'ok' | 'detail' | 'facts' | 'items'> {
  const c = preview.customer;
  if (!c) return { ok: false, detail: preview.unavailable[0]?.reason ?? 'No customer record' };
  const items = c.items.length;
  const facts = c.facts.length + c.items.reduce((n, i) => n + i.facts.length, 0);
  const missing = preview.unavailable.length ? `; ${preview.unavailable.length} unavailable` : '';
  return {
    ok: true,
    detail: `Found ${c.name}: ${facts} facts, ${items} items${missing}`,
    facts,
    items,
  };
}

async function runTest(
  deps: ConnectorDeps,
  workspaceId: string,
  customerId: string,
  email?: string,
) {
  const found = await sourcesConfigFor(deps, workspaceId);
  if (!found)
    return {
      ok: false,
      detail: 'This workspace has no product connection yet.',
      sources: [],
      preview: null,
    };
  const probe = await probeSources(found.config, customerId, email ?? null);
  return { ...summary(probe.preview), ...probe };
}

/** Where each workspace's product API is, as the records adapter reads it. */
const hostSource = (deps: ConnectorDeps): WorkspaceHostSource => ({
  defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
  configFor: (workspaceId) => sourcesConfigFor(deps, workspaceId),
});

/** Per-workspace product connections: read, save (encrypted), map and test. */
export function createConnectorService(deps: ConnectorDeps) {
  /** Every workspace's records behind one HostRecords, re-read when a connector is saved. */
  const records = workspaceHostRecords(hostSource(deps), () => deps.clock.now().getTime());
  const dto = async (s: Session) => toDto(await resolveConnector(deps, s.workspaceId));

  return {
    records,
    get: dto,
    async save(session: Session, input: SaveConnectorRequest): Promise<Connector> {
      await saveConnector(deps, session, input);
      return dto(session);
    },
    async saveMapping(session: Session, input: z.output<typeof SaveRecordMappingRequestSchema>) {
      await saveRecordMapping(deps, session, input);
      return dto(session);
    },
    async test(session: Session, customerId: string, email?: string): Promise<ConnectorTestResult> {
      const result = await runTest(deps, session.workspaceId, customerId, email);
      await deps.db.workspaceConnector.updateMany({
        where: { workspaceId: session.workspaceId },
        data: {
          lastTestAt: deps.clock.now(),
          lastTestOk: result.ok,
          lastTestDetail: result.detail,
        },
      });
      return result;
    },
    /** The workspace's own signing secret for host tokens, or null when it has no connector. */
    async secretFor(workspaceId: string): Promise<string | null> {
      const r = await withWorkspace(workspaceId, () => resolveConnector(deps, workspaceId));
      return r.source === 'WORKSPACE' ? r.config.signingSecret : null;
    },
  };
}

export type ConnectorService = ReturnType<typeof createConnectorService>;
