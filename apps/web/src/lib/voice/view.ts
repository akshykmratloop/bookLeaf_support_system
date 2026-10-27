import type { VoiceEndReason } from '@bookleaf/shared';
import { MicrophoneError } from './microphone';

export type CallPhase = 'idle' | 'starting' | 'connecting' | 'live' | 'ending' | 'ended' | 'failed';

export interface CallView {
  phase: CallPhase;
  callId: string | null;
  secondsLeft: number | null;
  lines: { role: 'AUTHOR' | 'ASSISTANT'; text: string }[];
  muted: boolean;
  timeWarning: boolean;
  ticketSuggested: boolean;
  endReason: VoiceEndReason | null;
  error: string | null;
}

export const INITIAL_VIEW: CallView = {
  phase: 'idle',
  callId: null,
  secondsLeft: null,
  lines: [],
  muted: false,
  timeWarning: false,
  ticketSuggested: false,
  endReason: null,
  error: null,
};

export const canStart = (phase: CallPhase) =>
  phase === 'idle' || phase === 'ended' || phase === 'failed';

export function micMessage(err: unknown, fallback: string): string {
  if (!(err instanceof MicrophoneError)) return fallback;
  return err.reason === 'denied'
    ? 'Microphone access was blocked. Allow the microphone for this site and try again.'
    : 'No microphone was found. Connect one and try again.';
}

export function closeMessage(code: number): string {
  if (code === 4409) return 'This call expired before it connected. Please start a new call.';
  if (code === 4503)
    return 'Voice calls are unavailable right now. You can use chat or raise a ticket.';
  return 'The call could not connect. Please try again.';
}
