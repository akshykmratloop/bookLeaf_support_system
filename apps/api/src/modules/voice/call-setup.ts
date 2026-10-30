import { randomUUID } from 'node:crypto';
import type { TicketDraft } from '@bookleaf/shared';
import type { Clock } from '../../platform/clock.js';
import type { HostRecords } from '../../host/types.js';
import type { Db } from '../../platform/db.js';
import { ConflictError } from '../../platform/errors.js';
import { toTicketDraft } from '../ticket-drafts/mappers.js';
import { TICKET_REF_SELECT } from '../tickets/ticket-ref.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';
import type { VoiceStyle } from '../../voice/call/persona.js';
import type { WorkspaceConfig } from '../settings/configs.js';
import { turnLimitError } from '../chat/limit.js';
import { chatLines, turnsLeft } from './chat-link.js';
import { buildCallContext, type CallContext, type ThreadContext } from './context.js';
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
    include: { ticket: { select: TICKET_REF_SELECT } },
  });
  return d ? toTicketDraft(d) : null;
}

interface SetupDeps {
  voiceStyle: VoiceStyle;
  db: Db;
  clock: Clock;
  records: HostRecords;
  drafts: TicketDraftService;
}

type OwnCall = Awaited<ReturnType<typeof findOwnCall>>;

/**
 * What the call continues. Inside a chat: the chat so far and the chat's ticket draft, so the call
 * and the screen share one conversation and one ticket. Otherwise: its call thread (a dropped call
 * continued) and that thread's draft.
 */
async function threadContext(
  deps: SetupDeps,
  authorId: string,
  call: OwnCall,
): Promise<ThreadContext> {
  if (call.chatSessionId) {
    const draft = await deps.drafts.forChat(authorId, call.chatSessionId);
    const earlier = recentLines(await chatLines(deps.db, call.chatSessionId));
    return { draft, earlier, from: 'chat', resumed: earlier.length > 0 };
  }
  const threadId = threadOf(call);
  const draft = await deps.drafts.forThread(authorId, threadId);
  const earlier = recentLines(await threadLines(deps.db, threadId, call.id));
  return { draft, earlier, from: 'call', resumed: threadId !== call.id };
}

/** Context for a connected call: its draft and the earlier conversation it continues. */
export async function contextFor(
  deps: SetupDeps,
  authorId: string,
  callId: string,
  { limits, voiceName }: Pick<WorkspaceConfig, 'limits' | 'voiceName'>,
): Promise<CallContext> {
  const call = await findOwnCall(deps.db, callId, authorId);
  const thread = await threadContext(deps, authorId, call);
  const maxTurns = limits.chat.maxTurnsPerSession;
  const left = await turnsLeft(deps.db, call.chatSessionId, maxTurns);
  // The chat may have filled up between starting the call and connecting it.
  if (left === 0) throw turnLimitError(maxTurns);
  const maxSeconds = limits.voice.maxCallSeconds;
  const style = deps.voiceStyle;
  return buildCallContext(deps, {
    authorId,
    maxSeconds,
    thread,
    turnsLeft: left,
    style,
    limits,
    voiceName,
  });
}
