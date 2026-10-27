import type {
  AssistantAdminStatus,
  AssistantAvailability,
  AssistantSettings,
  ChannelState,
  UpdateAssistantSettings,
} from '@bookleaf/shared';
import type { AssistantSettings as SettingsRow } from '@prisma/client';
import type { AiRuntime } from '../../ai/jobs/runtime.js';
import { PROVIDER_CATALOG, findModel } from '../../ai/providers/catalog.js';
import type { LlmProvider } from '../../ai/providers/types.js';
import type { Db } from '../../platform/db.js';
import { ConflictError, FeatureDisabledError, ValidationError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import type { AssistantLimits } from './limits.js';

interface Deps {
  db: Db;
  ai: AiRuntime;
  limits: AssistantLimits;
  /** True when the server holds a credential for the realtime voice provider. */
  voiceConfigured: boolean;
}

/** What a chat turn may use right now: a provider + model, or the reason it cannot run. */
export type ChatAccess =
  | { ok: true; provider: LlmProvider; providerId: string; model: string }
  | { ok: false; state: Exclude<ChannelState, 'AVAILABLE' | 'DISABLED'> };

const toDto = (s: SettingsRow): AssistantSettings => ({
  chatEnabled: s.chatEnabled,
  voiceEnabled: s.voiceEnabled,
  chatModel: s.chatModel,
  version: s.version,
  updatedAt: s.updatedAt.toISOString(),
});

/** The admin's chat model if it belongs to the active provider, else that provider's fast model. */
function chatModelFor(providerId: string, wanted: string): string {
  if (findModel(providerId, wanted)) return wanted;
  const provider = PROVIDER_CATALOG.find((p) => p.id === providerId);
  return provider?.models.find((m) => m.tier === 'fast')?.id ?? wanted;
}

export function createAssistantService({ db, ai, limits, voiceConfigured }: Deps) {
  const settings = () =>
    db.assistantSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  async function chatAccess(): Promise<ChatAccess> {
    const ai$ = await ai.settings();
    if (ai$.simulateOutage) return { ok: false, state: 'AI_OUTAGE' };
    const provider = ai.providerById(ai$.provider);
    if (!provider) return { ok: false, state: 'NOT_CONFIGURED' };
    const s = await settings();
    return {
      ok: true,
      provider,
      providerId: ai$.provider,
      model: chatModelFor(ai$.provider, s.chatModel),
    };
  }

  async function availability(): Promise<AssistantAvailability> {
    const s = await settings();
    const access = await chatAccess();
    const chatState: ChannelState = !s.chatEnabled
      ? 'DISABLED'
      : access.ok
        ? 'AVAILABLE'
        : access.state;
    const voiceState: ChannelState = !s.voiceEnabled
      ? 'DISABLED'
      : voiceConfigured
        ? 'AVAILABLE'
        : 'NOT_CONFIGURED';
    return {
      chat: {
        state: chatState,
        maxMessageChars: limits.chat.maxMessageChars,
        maxTurnsPerSession: limits.chat.maxTurnsPerSession,
        messagesPerMinute: limits.chat.messagesPerMinute,
        messagesPerDay: limits.chat.messagesPerDay,
      },
      voice: { state: voiceState, ...limits.voice },
    };
  }

  return {
    settings,
    availability,
    chatAccess,
    /** Server-side gate for every chat endpoint: the admin switch is checked on each request. */
    async requireChatEnabled(): Promise<void> {
      if (!(await settings()).chatEnabled) throw new FeatureDisabledError('Ask BookLeaf chat');
    },
    async requireVoiceEnabled(): Promise<void> {
      if (!(await settings()).voiceEnabled) throw new FeatureDisabledError('Voice support');
    },
    async adminStatus(): Promise<AssistantAdminStatus> {
      const ai$ = await ai.settings();
      const provider = PROVIDER_CATALOG.find((p) => p.id === ai$.provider);
      return {
        settings: toDto(await settings()),
        availability: await availability(),
        chatModels: (provider?.models ?? []).map((m) => ({
          id: m.id,
          label: m.label,
          tier: m.tier,
        })),
        voiceConfigured,
      };
    },
    async update(session: Session, input: UpdateAssistantSettings): Promise<AssistantSettings> {
      const current = await settings();
      if (input.chatModel !== undefined) {
        const ai$ = await ai.settings();
        if (!findModel(ai$.provider, input.chatModel))
          throw new ValidationError('Invalid assistant settings', [
            {
              path: 'chatModel',
              message: 'Model is not in the allowed list for the active provider',
            },
          ]);
      }
      const data = {
        chatEnabled: input.chatEnabled ?? current.chatEnabled,
        voiceEnabled: input.voiceEnabled ?? current.voiceEnabled,
        chatModel: input.chatModel ?? current.chatModel,
        updatedById: session.userId,
      };
      const res = await db.assistantSettings.updateMany({
        where: { id: 1, version: input.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (res.count === 0)
        throw new ConflictError(
          'VERSION_CONFLICT',
          'Assistant settings were changed by someone else. Reload and try again.',
        );
      await db.auditEvent.create({
        data: {
          actorId: session.userId,
          entityType: 'assistant_settings',
          entityId: '1',
          action: 'assistant_settings.updated',
          before: toDto(current),
          after: data,
        },
      });
      return toDto(await settings());
    },
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
