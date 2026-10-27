import { randomUUID } from 'node:crypto';
import type { TicketDraft } from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import type { HostRecords } from '../../host/types.js';
import type { Db } from '../../platform/db.js';
import { ConflictError } from '../../platform/errors.js';
import { toTicketDraft } from '../ticket-drafts/mappers.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';
import { buildCallContext, type CallContext } from './context.js';
import { findOwnCall } from './repository.js';
import { findResumable, recentLines, threadLines, threadOf } from './thread.js';

type Tx = Parameters<typeof findResumable>[0];

/** The new call's id and thread: its own, or the dropped call's when continuing. */
export async function newCallIds(tx: Tx, authorId: string, resume: boolean, now: Date) {
  const id = randomUUID();
  if (!resume) return { id, threadId: id };
  const last = await findResumable(tx, authorId, now);
  if (!last)
    throw new ConflictError('VOICE_NOTHING_TO_RESUME', 'There is no recent call to continue.');
  return { id, threadId: threadOf(last) };
}

export async function threadDraft(db: Db, threadId: string): Promise<TicketDraft | null> {
  const d = await db.ticketDraft.findUnique({
    where: { voiceThreadId: threadId },
    include: { ticket: { select: { id: true, number: true } } },
  });
  return d ? toTicketDraft(d) : null;
}

interface SetupDeps {
  db: Db;
  clock: Clock;
  records: HostRecords;
  drafts: TicketDraftService;
}

/** Context for a connected call: its thread's draft and, when continuing, the earlier lines. */
export async function contextFor(
  deps: SetupDeps,
  authorId: string,
  callId: string,
  maxSeconds: number,
): Promise<CallContext> {
  const call = await findOwnCall(deps.db, callId, authorId);
  const threadId = threadOf(call);
  const draft = await deps.drafts.forThread(authorId, threadId);
  const earlier = recentLines(await threadLines(deps.db, threadId, callId));
  const thread = { draft, earlier, resumed: threadId !== call.id };
  return buildCallContext(deps, { authorId, maxSeconds, thread });
}
