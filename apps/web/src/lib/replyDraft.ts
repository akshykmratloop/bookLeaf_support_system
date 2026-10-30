import type { Draft, TicketMessage } from '@bookleaf/shared';

/**
 * True once a reply to the author was sent after this draft was written: the draft has been
 * used, so the "review before sending" banner and the draft text no longer apply.
 */
export function isDraftAnswered(
  draft: Pick<Draft, 'createdAt'> | null,
  messages: readonly TicketMessage[],
): boolean {
  if (!draft) return false;
  const writtenAt = Date.parse(draft.createdAt);
  return messages.some((m) => m.kind === 'REPLY' && Date.parse(m.createdAt) >= writtenAt);
}
