import { HostUnavailableError } from './errors.js';
import { httpHostRecords } from './http/records.js';
import type { HostRecords } from './types.js';

/** Plain settings of one workspace's product API, as the HTTP adapter needs them. */
export interface WorkspaceHostConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  cacheSeconds: number;
}

export interface WorkspaceHostSource {
  /** The workspace's settings and a version that changes on every save (null = none). */
  configFor(workspaceId: string): Promise<{ config: WorkspaceHostConfig; version: string } | null>;
  defaultWorkspaceId: string;
}

/** How long a workspace's settings are trusted before being re-read from the database. */
const CONFIG_TTL_MS = 10_000;

interface Entry {
  version: string;
  records: HostRecords;
  checkedAt: number;
}

/**
 * One HostRecords for every workspace: picks the workspace's own connector (built once per
 * saved version, so its response cache survives between requests) and refuses when a
 * workspace has not configured one. The default workspace without a row uses env settings.
 */
export function workspaceHostRecords(src: WorkspaceHostSource, now: () => number): HostRecords {
  const entries = new Map<string, Entry>();

  const fresh = async (workspaceId: string): Promise<HostRecords> => {
    const found = await src.configFor(workspaceId);
    if (!found) {
      entries.delete(workspaceId);
      throw new HostUnavailableError('this workspace has no product connection yet');
    }
    const cached = entries.get(workspaceId);
    if (cached && cached.version === found.version) {
      cached.checkedAt = now();
      return cached.records;
    }
    const records = httpHostRecords({ ...found.config, now });
    entries.set(workspaceId, { version: found.version, records, checkedAt: now() });
    return records;
  };

  const recordsFor = async (workspaceId: string): Promise<HostRecords> => {
    const cached = entries.get(workspaceId);
    if (cached && now() - cached.checkedAt < CONFIG_TTL_MS) return cached.records;
    return fresh(workspaceId);
  };

  return {
    async customer(externalId, workspaceId = src.defaultWorkspaceId) {
      const records = await recordsFor(workspaceId);
      return records.customer(externalId);
    },
  };
}
