import {
  LIMIT_KEYS,
  type LimitKey,
  type Plan,
  type UpdateWorkspaceSettings,
} from '@bookleaf/shared';
import { ForbiddenError, ValidationError } from '../../platform/errors.js';
import type { AssistantLimits } from '../assistant/limits.js';

type SavedLimits = Record<LimitKey, number>;

/**
 * A customer's limits as they apply: its own value, never above its plan's maximum (U-7) or the
 * server's own hard caps. Saved values above a lowered maximum stay saved but are capped here.
 */
export function capLimits(s: SavedLimits, plan: Plan, server: AssistantLimits): AssistantLimits {
  const cap = (key: LimitKey) => Math.min(s[key], plan.max[key]);
  return {
    chat: {
      maxMessageChars: server.chat.maxMessageChars,
      messagesPerMinute: cap('messagesPerMinute'),
      messagesPerDay: cap('messagesPerDay'),
      maxTurnsPerSession: cap('maxTurnsPerSession'),
      sessionsPerHour: server.chat.sessionsPerHour,
    },
    voice: {
      maxCallSeconds: Math.min(cap('maxCallSeconds'), server.voice.maxCallSeconds),
      callsPerHour: cap('callsPerHour'),
      callsPerDay: cap('callsPerDay'),
    },
    drafts: server.drafts,
  };
}

/**
 * Server-side plan check for a customer's settings change (U-7): a feature the plan does not
 * include cannot be switched on (403), and no limit may go above the plan's maximum (422).
 */
export function assertWithinPlan(
  plan: Plan,
  input: Partial<Pick<UpdateWorkspaceSettings, 'chatEnabled' | 'voiceEnabled' | LimitKey>>,
): void {
  if (input.chatEnabled === true && !plan.chatAllowed)
    throw new ForbiddenError('Chat is not included in your plan. Contact your support provider.');
  if (input.voiceEnabled === true && !plan.voiceAllowed)
    throw new ForbiddenError(
      'Voice calls are not included in your plan. Contact your support provider.',
    );
  const errors = LIMIT_KEYS.flatMap((key) => {
    const value = input[key];
    if (value === undefined || value <= plan.max[key]) return [];
    return [{ path: key, message: `Your plan allows at most ${plan.max[key]}` }];
  });
  if (errors.length) throw new ValidationError('Above your plan’s limits', errors);
}
