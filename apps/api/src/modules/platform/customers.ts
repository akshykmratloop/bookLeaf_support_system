import type { CustomerList, CustomerSummary, UpdatePlan } from '@bookleaf/shared';
import type { Prisma } from '@prisma/client';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';
import { asPlatform } from '../../platform/tenancy.js';
import type { WorkspaceConfigs } from '../settings/configs.js';
import { toPlanState, type PlanReader } from './plans.js';
import { USAGE_DAYS, usageByWorkspace } from './usage.js';

export interface CustomerDeps {
  db: Db;
  clock: Clock;
  plans: PlanReader;
  configs: WorkspaceConfigs;
}

const DAY_MS = 86_400_000;

/** Everything the list shows about one customer: names and counts, no customer content. */
const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  ticketPrefix: true,
  isDefault: true,
  createdAt: true,
  plan: true,
  _count: { select: { members: true } },
} satisfies Prisma.WorkspaceSelect;

async function listCustomers(deps: CustomerDeps): Promise<CustomerList> {
  const since = new Date(deps.clock.now().getTime() - USAGE_DAYS * DAY_MS);
  const [rows, usageOf] = await Promise.all([
    deps.db.workspace.findMany({ select: LIST_SELECT, orderBy: { createdAt: 'asc' } }),
    usageByWorkspace(deps.db, since),
  ]);
  const items: CustomerSummary[] = rows.map((w) => {
    const state = toPlanState(w.plan);
    return {
      id: w.id,
      slug: w.slug,
      name: w.name,
      ticketPrefix: w.ticketPrefix,
      isDefault: w.isDefault,
      createdAt: w.createdAt.toISOString(),
      suspended: state.suspended,
      staff: w._count.members,
      plan: state.plan,
      planVersion: state.version,
      usage: usageOf(w.id),
    };
  });
  return { items, since: since.toISOString() };
}

function planData(input: UpdatePlan, now: Date): Prisma.WorkspacePlanUncheckedUpdateInput {
  const m = input.max ?? {};
  const data: Prisma.WorkspacePlanUncheckedUpdateInput = {
    chatAllowed: input.chatAllowed,
    voiceAllowed: input.voiceAllowed,
    aiEnabled: input.aiEnabled,
    maxMessagesPerMinute: m.messagesPerMinute,
    maxMessagesPerDay: m.messagesPerDay,
    maxTurnsPerSession: m.maxTurnsPerSession,
    maxCallsPerHour: m.callsPerHour,
    maxCallsPerDay: m.callsPerDay,
    maxCallSeconds: m.maxCallSeconds,
    version: { increment: 1 },
  };
  if (input.suspended !== undefined) data.suspendedAt = input.suspended ? now : null;
  return data;
}

/** Changes a customer's plan (version-checked). Takes effect on every server within seconds. */
async function updatePlan(deps: CustomerDeps, workspaceId: string, input: UpdatePlan) {
  const exists = await deps.db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!exists) throw new NotFoundError('Customer');
  // A workspace from before plans existed (or created outside signup) gets its row first.
  await deps.db.workspacePlan.upsert({
    where: { workspaceId },
    create: { workspaceId },
    update: {},
  });
  const res = await deps.db.workspacePlan.updateMany({
    where: { workspaceId, version: input.version },
    data: planData(input, deps.clock.now()),
  });
  if (res.count === 0)
    throw new ConflictError(
      'VERSION_CONFLICT',
      'This plan was changed by someone else. Reload and try again.',
    );
  deps.plans.invalidate(workspaceId);
  deps.configs.invalidate(workspaceId);
  const row = await deps.db.workspacePlan.findUniqueOrThrow({ where: { workspaceId } });
  return { ...toPlanState(row).plan, suspended: row.suspendedAt !== null, version: row.version };
}

/** The console's customers (U-7). Platform scope only: the owner connection reads every workspace. */
export function createCustomerService(deps: CustomerDeps) {
  return {
    list: () => asPlatform(() => listCustomers(deps)),
    updatePlan: (workspaceId: string, input: UpdatePlan) =>
      asPlatform(() => updatePlan(deps, workspaceId, input)),
  };
}

export type CustomerService = ReturnType<typeof createCustomerService>;
