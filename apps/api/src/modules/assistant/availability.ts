import type { AssistantAdminStatus, AssistantAvailability, ChannelState } from '@bookleaf/shared';
import { PROVIDER_CATALOG, findModel } from '../../ai/providers/catalog.js';
import type { LlmProvider } from '../../ai/providers/types.js';
import type { Session } from '../auth/session.js';
import { loadWorkspaceSettings } from '../settings/workspace-settings.js';
import { loadSettings, toSettingsDto, type AssistantDeps } from './deps.js';

/** What a chat turn may use right now: a provider + model, or the reason it cannot run. */
export type ChatAccess =
  | { ok: true; provider: LlmProvider; providerId: string; model: string }
  | { ok: false; state: Exclude<ChannelState, 'AVAILABLE' | 'DISABLED'> };

/** The admin's chat model if it belongs to the active provider, else that provider's fast model. */
function chatModelFor(providerId: string, wanted: string): string {
  if (findModel(providerId, wanted)) return wanted;
  const provider = PROVIDER_CATALOG.find((p) => p.id === providerId);
  return provider?.models.find((m) => m.tier === 'fast')?.id ?? wanted;
}

/** The workspace's chat model, else the platform's. */
async function wantedChatModel(deps: AssistantDeps, workspaceId: string): Promise<string> {
  const cfg = await deps.configs.forWorkspace(workspaceId);
  return cfg.chatModel ?? (await loadSettings(deps.db)).chatModel;
}

export async function chatAccess(deps: AssistantDeps, workspaceId: string): Promise<ChatAccess> {
  const { ai } = deps;
  const ai$ = await ai.settings();
  if (ai$.simulateOutage) return { ok: false, state: 'AI_OUTAGE' };
  const provider = await ai.providerFor(workspaceId, ai$.provider);
  if (!provider) return { ok: false, state: 'NOT_CONFIGURED' };
  const model = chatModelFor(ai$.provider, await wantedChatModel(deps, workspaceId));
  return { ok: true, provider, providerId: ai$.provider, model };
}

function chatState(enabled: boolean, access: ChatAccess): ChannelState {
  if (!enabled) return 'DISABLED';
  return access.ok ? 'AVAILABLE' : access.state;
}

function voiceState(enabled: boolean, configured: boolean): ChannelState {
  if (!enabled) return 'DISABLED';
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
  return {
    chat: {
      state: chatState(cfg.chatEnabled, access),
      maxMessageChars: limits.chat.maxMessageChars,
      maxTurnsPerSession: limits.chat.maxTurnsPerSession,
      messagesPerMinute: limits.chat.messagesPerMinute,
      messagesPerDay: limits.chat.messagesPerDay,
    },
    voice: {
      state: voiceState(cfg.voiceEnabled, await deps.voiceConfigured(workspaceId)),
      ...limits.voice,
    },
    brand: cfg.brand,
  };
}

/** The admin screen: this workspace's switches, availability and the chat models allowed. */
export async function adminStatus(
  deps: AssistantDeps,
  session: Session,
): Promise<AssistantAdminStatus> {
  const ai$ = await deps.ai.settings();
  const provider = PROVIDER_CATALOG.find((p) => p.id === ai$.provider);
  const ws = session.workspaceId;
  const [row, platform] = await Promise.all([
    loadWorkspaceSettings(deps.db, ws, deps.configs.seed),
    loadSettings(deps.db),
  ]);
  return {
    settings: toSettingsDto(row, platform.chatModel),
    availability: await availability(deps, ws),
    chatModels: (provider?.models ?? []).map((m) => ({ id: m.id, label: m.label, tier: m.tier })),
    voiceConfigured: await deps.voiceConfigured(ws),
  };
}
