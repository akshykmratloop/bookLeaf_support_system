import type { Env } from './config/index.js';
import { createAiUsageService } from './modules/ai-usage/service.js';
import { createSettingsService, type SettingsDeps } from './modules/settings/service.js';
import type { Clock } from './platform/clock.js';
import { ALL_VOICES, voiceSamplesFor } from './voice/providers/registry.js';
import type { VoiceProvider } from './voice/providers/types.js';

type WorkspaceAdminInputs = Pick<
  SettingsDeps,
  'db' | 'ai' | 'configs' | 'plans' | 'embedOrigins'
> & {
  env: Env;
  clock: Clock;
  voiceProvider: VoiceProvider | null;
  voiceFor: (workspaceId: string) => Promise<VoiceProvider | null>;
};

/** The workspace admin's own screens: settings and AI usage. */
export function createWorkspaceAdmin(c: WorkspaceAdminInputs) {
  const voices = c.voiceProvider?.voices ?? ALL_VOICES;
  return {
    settings: createSettingsService({
      db: c.db,
      ai: c.ai,
      voiceConfigured: async (ws: string) => (await c.voiceFor(ws)) !== null,
      voices,
      voiceSamples: voiceSamplesFor(c.env.VOICE_PROVIDER, voices),
      configs: c.configs,
      plans: c.plans,
      embedOrigins: c.embedOrigins,
    }),
    aiUsage: createAiUsageService({ db: c.db, clock: c.clock }),
  };
}
