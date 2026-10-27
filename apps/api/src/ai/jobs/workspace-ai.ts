import type { Db } from '../../platform/db.js';

/** A workspace's own AI choices for ticket work; nulls mean the platform's defaults. */
export interface WorkspaceAiChoices {
  workspaceId?: string;
  triageModel: string | null;
  draftModel: string | null;
  toneGuide: string;
}

const NONE: WorkspaceAiChoices = { triageModel: null, draftModel: null, toneGuide: '' };

/** The AI choices of the workspace that owns this ticket. */
export async function workspaceAiFor(db: Db, ticketId: string): Promise<WorkspaceAiChoices> {
  const t = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      workspaceId: true,
      workspace: {
        select: { settings: { select: { triageModel: true, draftModel: true, toneGuide: true } } },
      },
    },
  });
  if (!t) return NONE;
  return { ...(t.workspace.settings ?? NONE), workspaceId: t.workspaceId };
}
