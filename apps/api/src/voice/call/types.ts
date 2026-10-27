import type {
  TicketProposal,
  TranscriptLine,
  VoiceEndReason,
  VoiceServerMessage,
} from '@bookleaf/shared';
import type { VoiceProvider, VoiceSession, VoiceSessionConfig } from '../providers/types.js';

/** The browser side of the call (a WebSocket in production, a fake in tests). */
export interface CallerChannel {
  sendAudio(pcm16: Buffer): void;
  send(message: VoiceServerMessage): void;
  close(): void;
}

export interface CallOutcome {
  reason: VoiceEndReason;
  transcript: TranscriptLine[];
  proposal: TicketProposal | null;
  inputTokens: number;
  outputTokens: number;
  startedAt: Date;
  endedAt: Date;
}

export interface CallLimits {
  maxSeconds: number;
  warnBeforeEndSeconds: number;
  idleSeconds: number;
  /** How often the admin switch is re-checked during the call. */
  recheckSeconds: number;
  /** Longest wait for the goodbye after end_call before hanging up anyway. */
  goodbyeSeconds: number;
}

export interface CallDeps {
  provider: VoiceProvider;
  config: VoiceSessionConfig;
  books: readonly { id: string }[];
  limits: CallLimits;
  caller: CallerChannel;
  now: () => Date;
  isStillAllowed: () => Promise<boolean>;
  onEnd: (outcome: CallOutcome) => Promise<void>;
  /** Reports a problem that must not end the call or the process. */
  warn: (message: string, err: unknown) => void;
}

export interface CallHandle {
  onCallerAudio(pcm16: Buffer): void;
  onCallerHangup(): void;
  onCallerGone(): void;
}

export interface CallState {
  deps: CallDeps;
  startedAt: Date;
  /** Monotonic ms when the limit timers were armed (elapsed time only). */
  armedAt: number;
  transcript: TranscriptLine[];
  usage: { inputTokens: number; outputTokens: number };
  proposal: TicketProposal | null;
  session: VoiceSession | null;
  /**
   * Monotonic ms of the last sign of conversation: speech detected, a transcript, or assistant
   * audio. Raw caller frames do not count, because the browser streams silence continuously.
   */
  lastActivityAt: number;
  /** The assistant asked to end the call; hang up once its goodbye has been spoken. */
  endRequested: boolean;
  /** Assistant audio arrived after end_call, so the next finished reply is the goodbye. */
  goodbyeStarted: boolean;
  checkingSwitch: boolean;
  ended: boolean;
  timers: ReturnType<typeof setTimeout>[];
}
