export const NOT_IN_PLAN = 'Not included in your plan. Ask your support provider to turn it on.';
export const AI_OFF = 'AI is switched off for this workspace by your support provider.';

/**
 * Why a chat or voice switch cannot be turned on (the plan does not include it, or the support
 * provider switched AI off for the workspace), or undefined when the customer may change it.
 * A channel that is already on can always be switched off.
 */
export function lockReason(
  allowed: boolean,
  aiEnabled: boolean,
  isOn: boolean,
): string | undefined {
  if (isOn) return undefined;
  if (!aiEnabled) return AI_OFF;
  return allowed ? undefined : NOT_IN_PLAN;
}
