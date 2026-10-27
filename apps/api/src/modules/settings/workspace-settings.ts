import type { UpdateWorkspaceSettings, WorkspaceSettings } from '@bookleaf/shared';
import type { WorkspaceSettings as Row } from '@prisma/client';
import type { Db } from '../../platform/db.js';
import { ConflictError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { SeedValues } from './configs.js';

export const toSettingsDto = (s: Row): WorkspaceSettings => ({
  triageModel: s.triageModel,
  draftModel: s.draftModel,
  chatModel: s.chatModel,
  toneGuide: s.toneGuide,
  chatEnabled: s.chatEnabled,
  messagesPerMinute: s.messagesPerMinute,
  messagesPerDay: s.messagesPerDay,
  maxTurnsPerSession: s.maxTurnsPerSession,
  voiceEnabled: s.voiceEnabled,
  voiceName: s.voiceName,
  maxCallSeconds: s.maxCallSeconds,
  callsPerHour: s.callsPerHour,
  callsPerDay: s.callsPerDay,
  allowedOrigins: s.allowedOrigins,
  brandName: s.brandName,
  brandColor: s.brandColor,
  customerNoun: s.customerNoun,
  itemNoun: s.itemNoun,
  version: s.version,
  updatedAt: s.updatedAt.toISOString(),
});

/** Values a new row starts with (the platform's current ones). */
export type Seed = () => Promise<SeedValues>;

/** The workspace's row, created from the platform values on first read. */
export async function loadWorkspaceSettings(db: Db, workspaceId: string, seed: Seed): Promise<Row> {
  const existing = await db.workspaceSettings.findUnique({ where: { workspaceId } });
  if (existing) return existing;
  const create = { workspaceId, ...(await seed()) };
  return db.workspaceSettings.upsert({ where: { workspaceId }, create, update: {} });
}

const CONFLICT = () =>
  new ConflictError(
    'VERSION_CONFLICT',
    'Workspace settings were changed by someone else. Reload and try again.',
  );

/** Applies the given fields (others unchanged). Stale versions conflict; change + audit commit together. */
export async function updateWorkspaceSettings(
  db: Db,
  session: Session,
  input: UpdateWorkspaceSettings,
  seed: Seed,
): Promise<Row> {
  const workspaceId = session.workspaceId;
  const current = await loadWorkspaceSettings(db, workspaceId, seed);
  const { version, ...changes } = input;
  const data = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
  return db.$transaction(async (tx) => {
    const res = await tx.workspaceSettings.updateMany({
      where: { workspaceId, version },
      data: { ...data, updatedById: session.userId, version: { increment: 1 } },
    });
    if (res.count === 0) throw CONFLICT();
    await tx.auditEvent.create({
      data: {
        workspaceId,
        actorId: session.userId,
        entityType: 'workspace_settings',
        entityId: current.id,
        action: 'workspace_settings.updated',
        before: Object.fromEntries(Object.keys(data).map((k) => [k, current[k as keyof Row]])),
        after: data,
      },
    });
    return tx.workspaceSettings.findUniqueOrThrow({ where: { workspaceId } });
  });
}
