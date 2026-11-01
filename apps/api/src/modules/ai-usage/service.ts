import type { Session } from '../auth/session.js';
import { usageReport, type UsageReportDeps } from './report.js';

/**
 * AI usage for a workspace's own admins. The request already runs as the session's workspace
 * (row-level security), and the report filters by that workspace as well.
 */
export function createAiUsageService(deps: UsageReportDeps) {
  return {
    forWorkspace: (session: Session) => usageReport(deps, session.workspaceId),
  };
}

export type AiUsageService = ReturnType<typeof createAiUsageService>;
