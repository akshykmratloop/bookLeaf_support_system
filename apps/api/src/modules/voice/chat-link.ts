import type { Prisma } from '@prisma/client';
import type { TranscriptLine } from '@bookleaf/shared';
import { NotFoundError } from '../../platform/errors.js';
import { turnLimitError } from '../chat/limit.js';

type Tx = Prisma.TransactionClient;

/** The chat a new call joins: the author's own, with turns left. Another author's is "not found". */
export async function joinableChat(
  tx: Tx,
  authorId: string,
  chatSessionId: string,
  maxTurns: number,
): Promise<string> {
  const chat = await tx.chatSession.findFirst({
    where: { id: chatSessionId, authorId },
    select: { id: true, turnCount: true },
  });
  if (!chat) throw new NotFoundError('Chat session');
  if (chat.turnCount >= maxTurns) throw turnLimitError(maxTurns);
  return chat.id;
}

/** The conversation so far, typed and spoken, as call lines, oldest first. */
export async function chatLines(db: Tx, chatSessionId: string): Promise<TranscriptLine[]> {
  const rows = await db.chatMessage.findMany({
    where: { sessionId: chatSessionId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, body: true, createdAt: true },
  });
  return rows.map((r) => ({ role: r.role, text: r.body, at: r.createdAt.toISOString() }));
}

/** Author turns a chat has left, or null when the call is not part of a chat (no limit). */
export async function turnsLeft(db: Tx, chatSessionId: string | null, maxTurns: number) {
  if (!chatSessionId) return null;
  const chat = await db.chatSession.findUnique({
    where: { id: chatSessionId },
    select: { turnCount: true },
  });
  return Math.max(0, maxTurns - (chat?.turnCount ?? maxTurns));
}

/**
 * Saves a finished call's lines into the chat it was started from, in spoken order, so the chat
 * (and its AI) continues knowing what was said. Each line the author spoke uses one turn.
 */
export async function saveIntoChat(
  tx: Tx,
  call: { id: string; chatSessionId: string | null },
  lines: readonly TranscriptLine[],
): Promise<void> {
  const chatId = call.chatSessionId;
  if (!chatId || lines.length === 0) return;
  await tx.chatMessage.createMany({
    data: lines.map((l) => ({
      sessionId: chatId,
      role: l.role,
      body: l.text,
      channel: 'VOICE' as const,
      voiceSessionId: call.id,
      createdAt: new Date(l.at),
    })),
  });
  const spoken = lines.filter((l) => l.role === 'AUTHOR').length;
  if (spoken > 0)
    await tx.chatSession.update({
      where: { id: chatId },
      data: { turnCount: { increment: spoken } },
    });
}
