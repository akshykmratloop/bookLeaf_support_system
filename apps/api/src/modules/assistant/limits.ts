import { CHAT_MESSAGE_LIMITS } from '@bookleaf/shared';
import type { Env } from '../../platform/env.js';

/** Per-author usage limits for the assistant channels, read once from validated env. */
export interface AssistantLimits {
  chat: {
    maxMessageChars: number;
    messagesPerMinute: number;
    messagesPerDay: number;
    maxTurnsPerSession: number;
    sessionsPerHour: number;
  };
  voice: { maxCallSeconds: number; callsPerHour: number; callsPerDay: number };
}

export function limitsFromEnv(env: Env): AssistantLimits {
  return {
    chat: {
      maxMessageChars: CHAT_MESSAGE_LIMITS.max,
      messagesPerMinute: env.CHAT_MESSAGES_PER_MINUTE,
      messagesPerDay: env.CHAT_MESSAGES_PER_DAY,
      maxTurnsPerSession: env.CHAT_MAX_TURNS_PER_SESSION,
      sessionsPerHour: env.CHAT_SESSIONS_PER_HOUR,
    },
    voice: {
      maxCallSeconds: env.VOICE_MAX_CALL_SECONDS,
      callsPerHour: env.VOICE_CALLS_PER_HOUR,
      callsPerDay: env.VOICE_CALLS_PER_DAY,
    },
  };
}

/** Start of the current UTC day, for daily quotas. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
