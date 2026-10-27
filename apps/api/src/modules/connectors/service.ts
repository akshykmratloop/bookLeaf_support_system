import type { Connector, ConnectorTestResult, SaveConnectorRequest } from '@bookleaf/shared';
import type { WorkspaceConnector } from '@prisma/client';
import { CustomerNotFoundError, HostUnavailableError } from '../../host/errors.js';
import type { HostRecords } from '../../host/types.js';
import { workspaceHostRecords, type WorkspaceHostSource } from '../../host/workspaces.js';
import type { Session } from '../auth/session.js';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/constants.js';
import type { ConnectorDeps } from './deps.js';
import { saveConnector } from './save.js';
import { resolveConnector, type Resolved } from './store.js';
import { assertSafeUrl } from '../../platform/net/ssrf.js';

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

/** The connector as the UI sees it: URLs, limits, secret hints; never a secret. */
function toDto(r: Resolved): Connector {
  const c = r.config ?? { baseUrl: null, signInUrl: null, timeoutMs: 3000, cacheSeconds: 60 };
  return {
    configured: r.source !== 'NONE',
    source: r.source,
    baseUrl: c.baseUrl,
    signInUrl: c.signInUrl,
    ...hints(r),
    timeoutMs: c.timeoutMs,
    cacheSeconds: c.cacheSeconds,
    lastTest: lastTestOf(r.row),
    version: r.row?.version ?? 0,
  };
}

/** Tries the product endpoint for one customer id; wording is safe to show the admin. */
async function tryCustomer(records: HostRecords, workspaceId: string, customerId: string) {
  try {
    const c = await records.customer(customerId, workspaceId);
    const items = c.items.length;
    const facts = c.facts.length + c.items.reduce((n, i) => n + i.facts.length, 0);
    return { ok: true, detail: `Found ${c.name}: ${facts} facts, ${items} items`, facts, items };
  } catch (err) {
    if (err instanceof CustomerNotFoundError)
      return { ok: false, detail: 'Connected, but the product does not know this customer id' };
    if (err instanceof HostUnavailableError) return { ok: false, detail: err.message };
    throw err;
  }
}

/** Where each workspace's product API is, as the records adapter reads it. */
function hostSource(deps: ConnectorDeps): WorkspaceHostSource {
  return {
    defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
    async configFor(workspaceId) {
      const r = await resolveConnector(deps, workspaceId);
      if (!r.config) return null;
      const version = r.row ? `${r.row.version}:${r.row.updatedAt.getTime()}` : 'env';
      // A tenant's own URL is checked again at every request; env settings are the operator's.
      const checkUrl = r.row
        ? async (url: URL) => void (await assertSafeUrl(url.toString(), deps.ssrf))
        : undefined;
      return { config: { ...r.config, checkUrl }, version };
    },
  };
}

/** Per-workspace product connections: read, save (encrypted) and test. */
export function createConnectorService(deps: ConnectorDeps) {
  /** Every workspace's records behind one HostRecords, re-read when a connector is saved. */
  const records = workspaceHostRecords(hostSource(deps), () => deps.clock.now().getTime());

  return {
    records,
    async get(session: Session): Promise<Connector> {
      return toDto(await resolveConnector(deps, session.workspaceId));
    },
    async save(session: Session, input: SaveConnectorRequest): Promise<Connector> {
      await saveConnector(deps, session, input);
      return toDto(await resolveConnector(deps, session.workspaceId));
    },
    async test(session: Session, customerId: string): Promise<ConnectorTestResult> {
      const result = await tryCustomer(records, session.workspaceId, customerId);
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
      const r = await resolveConnector(deps, workspaceId);
      return r.source === 'WORKSPACE' ? r.config.signingSecret : null;
    },
  };
}

export type ConnectorService = ReturnType<typeof createConnectorService>;
