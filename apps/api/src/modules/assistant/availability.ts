import type { AssistantAdminStatus, AssistantAvailability, ChannelState } from '@bookleaf/shared';
import type { LlmProvider } from '../../ai/providers/types.js';
import { AiError } from '../../ai/providers/errors.js';
import type { Session } from '../auth/session.js';
import { loadWorkspaceSettings } from '../settings/workspace-settings.js';
import { toSettingsDto, type AssistantDeps } from './deps.js';

/** What a chat turn may use right now: a provider + model, or the reason it cannot run. */
export type ChatAccess =
  | { ok: true; provider: LlmProvider; providerId: string; model: string }
  | { ok: false; state: Exclude<ChannelState, 'AVAILABLE' | 'DISABLED'> };

/** The platform's chat model on the platform's provider; AI off (globally or for the customer) = outage. */
export async function chatAccess(deps: AssistantDeps, workspaceId: string): Promise<ChatAccess> {
  try {
    const { provider, model, providerId } = await deps.ai.resolve('CHAT', { workspaceId });
    return { ok: true, provider, providerId, model };
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return { ok: false, state: err.code === 'AI_NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'AI_OUTAGE' };
  }
}

function chatState(enabled: boolean, access: ChatAccess): ChannelState {
  if (!enabled) return 'DISABLED';
  return access.ok ? 'AVAILABLE' : access.state;
}

function voiceState(enabled: boolean, configured: boolean, aiEnabled: boolean): ChannelState {
  if (!enabled) return 'DISABLED';
  if (!aiEnabled) return 'AI_OUTAGE';
  return configured ? 'AVAILABLE' : 'NOT_CONFIGURED';
}

/** Whether chat and voice are switched on and usable in this workspace, with its limits. */
export async function availability(
  deps: AssistantDeps,
  workspaceId: string,
): Promise<AssistantAvailability> {
  const cfg = await deps.configs.forWorkspace(workspaceId);
  const { limits } = cfg;
  const access = await chatAccess(deps, workspaceId);
  const voiceConfigured = await deps.voiceConfigured(workspaceId);
  return {
    chat: {
      state: chatState(cfg.chatEnabled, access),
      maxMessageChars: limits.chat.maxMessageChars,
      maxTurnsPerSession: limits.chat.maxTurnsPerSession,
      messagesPerMinute: limits.chat.messagesPerMinute,
      messagesPerDay: limits.chat.messagesPerDay,
    },
    voice: {
      state: voiceState(cfg.voiceEnabled, voiceConfigured, cfg.aiEnabled),
      ...limits.voice,
    },
    brand: cfg.brand,
  };
}

/** The admin screen: this workspace's switches, availability and what its plan allows. */
export async function adminStatus(
  deps: AssistantDeps,
  session: Session,
): Promise<AssistantAdminStatus> {
  const ws = session.workspaceId;
  const [row, { plan }] = await Promise.all([
    loadWorkspaceSettings(deps.db, ws, deps.configs.seed),
    deps.plans.forWorkspace(ws),
  ]);
  return {
    settings: toSettingsDto(row),
    availability: await availability(deps, ws),
    plan,
    voiceConfigured: await deps.voiceConfigured(ws),
  };
}
