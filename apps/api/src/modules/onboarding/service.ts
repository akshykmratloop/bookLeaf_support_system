import type { OnboardingStatus, OnboardingTestTicket } from '@bookleaf/shared';
import type { Session } from '../auth/session.js';
import type { TicketDeps } from '../tickets/deps.js';
import { readFacts, readWorkspace, type FactsDeps } from './read-facts.js';
import { buildSteps } from './steps.js';
import { sendTestTicket } from './test-ticket.js';

export interface OnboardingDeps extends FactsDeps {
  tickets: TicketDeps;
  /** Where the support app runs (APP_ORIGIN): code samples load the widget from here. */
  supportUrl: string;
  /** The integration guide's address, when the server has one (INTEGRATION_DOCS_URL). */
  docsUrl: string | null;
}

/** The "Get started" setup guide (U-12): eight steps, each from a real check of this workspace. */
export function createOnboardingService(deps: OnboardingDeps) {
  const supportUrl = deps.supportUrl.replace(/\/+$/, '');
  return {
    async status(session: Session): Promise<OnboardingStatus> {
      const ws = await readWorkspace(deps.db, session.workspaceId);
      const facts = await readFacts(deps, ws, session.workspaceId);
      const t = facts.testTicket;
      return {
        workspace: { slug: ws.slug, name: ws.name },
        supportUrl,
        docsUrl: deps.docsUrl,
        steps: buildSteps(facts),
        testTicket: t ? { id: t.id, label: t.label, createdAt: t.createdAt.toISOString() } : null,
      };
    },
    sendTestTicket: (session: Session): Promise<OnboardingTestTicket> =>
      sendTestTicket(deps.tickets, session),
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;
