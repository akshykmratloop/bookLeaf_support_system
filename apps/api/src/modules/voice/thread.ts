import type { Prisma } from '@prisma/client';
import { RESUME_WITHIN_MINUTES, TranscriptLineSchema, type TranscriptLine } from '@bookleaf/shared';
import { z } from 'zod';

/** Earlier lines a continued call is given: the most recent ones, within a size cap. */
const EARLIER_MAX_LINES = 30;
const EARLIER_MAX_CHARS = 6000;

const Lines = z.array(TranscriptLineSchema);
type Tx = Prisma.TransactionClient;

/** A first call is its own thread; a continued call carries the thread it continues. */
export const threadOf = (c: { id: string; threadId: string | null }) => c.threadId ?? c.id;

const inThread = (threadId: string) => ({ OR: [{ id: threadId }, { threadId }] });

/** A stored transcript, or no lines if it is not in the expected shape. */
export const linesOf = (transcript: unknown): TranscriptLine[] => {
  const parsed = Lines.safeParse(transcript);
  return parsed.success ? parsed.data : [];
};

interface DraftFields {
  subject: string;
  description: string;
  category: string | null;
}

/** Whether a call left anything worth continuing: the author spoke, or a draft was started. */
function worthContinuing(transcript: unknown, draft: DraftFields | null): boolean {
  const drafted = Boolean(draft && (draft.subject || draft.description || draft.category));
  return drafted || linesOf(transcript).some((l) => l.role === 'AUTHOR');
}

/**
 * The author's last connected call, if it can be continued: it ended less than
 * RESUME_WITHIN_MINUTES ago, the author said something or a draft was started, and no ticket
 * was sent from it. A call that never got past the greeting is not worth continuing.
 */
export async function findResumable(db: Tx, authorId: string, now: Date) {
  const last = await db.voiceSession.findFirst({
    where: { authorId, startedAt: { not: null }, status: { in: ['ENDED', 'FAILED'] } },
    orderBy: { createdAt: 'desc' },
    include: { ticket: { select: { id: true } } },
  });
  const cutoff = now.getTime() - RESUME_WITHIN_MINUTES * 60_000;
  if (!last?.endedAt || last.endedAt.getTime() < cutoff || last.ticket) return null;
  const draft = await db.ticketDraft.findUnique({ where: { voiceThreadId: threadOf(last) } });
  if (draft?.status === 'SUBMITTED') return null;
  return worthContinuing(last.transcript, draft) ? last : null;
}

/** Every line of the thread's calls, oldest first, optionally leaving out one call. */
export async function threadLines(db: Tx, threadId: string, exceptCallId?: string) {
  const calls = await db.voiceSession.findMany({
    where: { ...inThread(threadId), ...(exceptCallId ? { id: { not: exceptCallId } } : {}) },
    orderBy: { createdAt: 'asc' },
    select: { transcript: true },
  });
  return calls.flatMap((c) => linesOf(c.transcript));
}

/** The end of the earlier conversation, small enough to put in the call's instructions. */
export function recentLines(lines: readonly TranscriptLine[]): TranscriptLine[] {
  const kept: TranscriptLine[] = [];
  let chars = 0;
  for (const line of [...lines].reverse()) {
    if (kept.length >= EARLIER_MAX_LINES || chars + line.text.length > EARLIER_MAX_CHARS) break;
    kept.unshift(line);
    chars += line.text.length;
  }
  return kept;
}
