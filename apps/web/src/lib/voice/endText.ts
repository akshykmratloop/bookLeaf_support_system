import type { VoiceEndReason } from '@bookleaf/shared';
import type { CallView } from './view';

/** Why a call ended, in the author's words. */
export const ENDED_TEXT: Record<VoiceEndReason, string> = {
  USER_HANGUP: 'You ended the call.',
  TIME_LIMIT: 'The call reached its time limit.',
  ASSISTANT_ENDED: 'The call has ended.',
  IDLE: "The call ended because we couldn't hear you.",
  DISCONNECTED: 'The connection was lost.',
  DISABLED_BY_ADMIN: 'Voice calls were switched off by the BookLeaf team.',
  PROVIDER_ERROR: 'The voice service had a problem, so the call ended.',
  SERVER_RESTART: 'The call was interrupted.',
  TURN_LIMIT: 'This conversation reached its message limit, so the call ended.',
};

/** What to say under the chat after a call: why it could not start, failed or ended. */
export function callNotice(
  view: CallView,
  startError: string | null,
): { text: string; isError: boolean } | null {
  if (startError) return { text: startError, isError: true };
  if (view.phase === 'failed' && view.error) return { text: view.error, isError: true };
  if (view.phase === 'ended' && view.endReason)
    return { text: ENDED_TEXT[view.endReason], isError: false };
  return null;
}
