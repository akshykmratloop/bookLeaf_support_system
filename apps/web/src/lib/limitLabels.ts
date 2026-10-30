import type { LimitKey } from '@bookleaf/shared';

/** Plain names for the chat and call limits, shared by the console and the customer settings. */
export const LIMIT_LABELS: Record<LimitKey, { label: string; unit: string }> = {
  messagesPerMinute: { label: 'Chat messages per minute', unit: 'per visitor' },
  messagesPerDay: { label: 'Chat messages per day', unit: 'per visitor' },
  maxTurnsPerSession: { label: 'Turns per conversation', unit: 'messages' },
  callsPerHour: { label: 'Calls per hour', unit: 'per visitor' },
  callsPerDay: { label: 'Calls per day', unit: 'per visitor' },
  maxCallSeconds: { label: 'Longest call', unit: 'seconds' },
};
