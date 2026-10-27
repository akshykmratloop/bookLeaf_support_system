import type { AssistantAdminStatus, AssistantAvailability, ChannelState } from '@bookleaf/shared';
import { PROVIDER_CATALOG, findModel } from '../../ai/providers/catalog.js';
import type { LlmProvider } from '../../ai/providers/types.js';
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

export async function chatAccess({ db, ai }: AssistantDeps): Promise<ChatAccess> {
  const ai$ = await ai.settings();
  if (ai$.simulateOutage) return { ok: false, state: 'AI_OUTAGE' };
  const provider = ai.providerById(ai$.provider);
  if (!provider) return { ok: false, state: 'NOT_CONFIGURED' };
  const s = await loadSettings(db);
  return {
    ok: true,
    provider,
    providerId: ai$.provider,
    model: chatModelFor(ai$.provider, s.chatModel),
  };
}

function chatState(enabled: boolean, access: ChatAccess): ChannelState {
  if (!enabled) return 'DISABLED';
  return access.ok ? 'AVAILABLE' : access.state;
}

function voiceState(enabled: boolean, configured: boolean): ChannelState {
  if (!enabled) return 'DISABLED';
  return configured ? 'AVAILABLE' : 'NOT_CONFIGURED';
}

/** Whether chat and voice are switched on and usable, with the per-author limits. */
export async function availability(deps: AssistantDeps): Promise<AssistantAvailability> {
  const { limits } = deps;
  const s = await loadSettings(deps.db);
  const access = await chatAccess(deps);
  return {
    chat: {
      state: chatState(s.chatEnabled, access),
      maxMessageChars: limits.chat.maxMessageChars,
      maxTurnsPerSession: limits.chat.maxTurnsPerSession,
      messagesPerMinute: limits.chat.messagesPerMinute,
      messagesPerDay: limits.chat.messagesPerDay,
    },
    voice: { state: voiceState(s.voiceEnabled, deps.voiceConfigured), ...limits.voice },
  };
}

/** The admin screen: switches, availability and the chat models allowed. */
export async function adminStatus(deps: AssistantDeps): Promise<AssistantAdminStatus> {
  const ai$ = await deps.ai.settings();
  const provider = PROVIDER_CATALOG.find((p) => p.id === ai$.provider);
  return {
    settings: toSettingsDto(await loadSettings(deps.db)),
    availability: await availability(deps),
    chatModels: (provider?.models ?? []).map((m) => ({ id: m.id, label: m.label, tier: m.tier })),
    voiceConfigured: deps.voiceConfigured,
  };
}
