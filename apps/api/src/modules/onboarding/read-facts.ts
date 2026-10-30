import { SETUP_TEST_CUSTOMER_ID } from '@bookleaf/shared';
import type { Db } from '../../platform/db.js';
import { NotFoundError } from '../../platform/errors.js';
import { labelOf, TICKET_LABEL_SELECT } from '../tickets/ticket-ref.js';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/constants.js';
import type { ConnectionFact, FailedDelivery, OnboardingFacts, TestTicketFact } from './facts.js';

export interface FactsDeps {
  db: Db;
  /** Whether allowed sites may frame the widget on this server (embed mode). */
  embedded: boolean;
  /** The origins that may frame a workspace's widget now (cached; env origins for BookLeaf). */
  originsFor(slug: string): Promise<readonly string[] | null>;
}

const WORKSPACE_SELECT = {
  slug: true,
  name: true,
  lastHandOverAt: true,
  lastWidgetLoadAt: true,
  lastWidgetOrigin: true,
} as const;

/**
 * Called inside the admin's request, so every query below runs as that workspace (row-level
 * security): another workspace's rows are invisible even without the `workspaceId` filters.
 */
export async function readWorkspace(db: Db, workspaceId: string) {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: WORKSPACE_SELECT,
  });
  if (!ws) throw new NotFoundError('Workspace');
  return ws;
}

async function connectionOf(db: Db, workspaceId: string): Promise<ConnectionFact> {
  const row = await db.workspaceConnector.findUnique({
    where: { workspaceId },
    select: { lastTestAt: true, lastTestOk: true, lastTestDetail: true },
  });
  if (!row) return workspaceId === DEFAULT_WORKSPACE_ID ? { kind: 'env' } : { kind: 'none' };
  const tested = row.lastTestAt !== null && row.lastTestOk !== null;
  return {
    kind: 'saved',
    lastTest: tested
      ? {
          ok: Boolean(row.lastTestOk),
          at: row.lastTestAt as Date,
          detail: row.lastTestDetail ?? '',
        }
      : null,
  };
}

/** The latest webhook delivery that finished, when it is a failure (gave up). */
async function failedDelivery(db: Db, workspaceId: string): Promise<FailedDelivery | null> {
  const last = await db.webhookDelivery.findFirst({
    where: { webhook: { workspaceId, active: true }, status: { in: ['SUCCEEDED', 'FAILED'] } },
    orderBy: { createdAt: 'desc' },
    select: { status: true, event: true, responseStatus: true, lastError: true },
  });
  if (last?.status !== 'FAILED') return null;
  return { event: last.event, responseStatus: last.responseStatus, lastError: last.lastError };
}

const testCustomer = { author: { externalId: SETUP_TEST_CUSTOMER_ID } };

async function ticketFacts(db: Db, workspaceId: string) {
  const [real, test] = await Promise.all([
    db.ticket.findFirst({
      where: { workspaceId, NOT: testCustomer },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    db.ticket.findFirst({
      where: { workspaceId, ...testCustomer },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, ...TICKET_LABEL_SELECT },
    }),
  ]);
  const testTicket: TestTicketFact | null = test
    ? { id: test.id, label: labelOf(test), createdAt: test.createdAt }
    : null;
  return { firstRealTicketAt: real?.createdAt ?? null, testTicket };
}

function countFacts(db: Db, workspaceId: string) {
  const where = { workspaceId };
  return Promise.all([
    db.workspaceDataSource.count({ where: { ...where, format: 'CONTRACT' } }),
    db.customerField.count({ where }),
    db.customerField.count({ where: { ...where, sourceId: { not: null }, path: { not: null } } }),
    db.category.count({ where: { ...where, isActive: true } }),
    db.knowledgeArticle.count({ where: { ...where, isActive: true } }),
    db.workspaceApiKey.count({ where: { ...where, revokedAt: null } }),
    db.workspaceWebhook.count({ where: { ...where, active: true } }),
  ]);
}

/** Every fact the eight steps need, read in parallel. */
export async function readFacts(
  deps: FactsDeps,
  ws: Awaited<ReturnType<typeof readWorkspace>>,
  workspaceId: string,
): Promise<OnboardingFacts> {
  const { db } = deps;
  const [connection, counts, failed, tickets, origins] = await Promise.all([
    connectionOf(db, workspaceId),
    countFacts(db, workspaceId),
    failedDelivery(db, workspaceId),
    ticketFacts(db, workspaceId),
    deps.originsFor(ws.slug),
  ]);
  const [contract, fieldsTotal, fieldsMapped, categories, articles, apiKeys, webhooks] = counts;
  const widgetLoad =
    ws.lastWidgetLoadAt && ws.lastWidgetOrigin
      ? { at: ws.lastWidgetLoadAt, origin: ws.lastWidgetOrigin }
      : null;
  return {
    embedded: deps.embedded,
    connection,
    // The server's own settings (BookLeaf on env) are one full-shape source.
    hasContractSource: connection.kind === 'env' || contract > 0,
    fields: { total: fieldsTotal, mapped: fieldsMapped },
    handOverAt: ws.lastHandOverAt,
    widgetLoad,
    allowedOrigins: origins ?? [],
    categories,
    articles,
    apiKeys,
    webhooks,
    failedDelivery: failed,
    ...tickets,
  };
}
