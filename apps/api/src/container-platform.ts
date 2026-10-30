import type { Env } from './config/index.js';
import type { LlmProvider } from './ai/providers/types.js';
import type { AiRuntime } from './ai/jobs/runtime.js';
import { createPlatformAiAdmin } from './modules/platform/ai-admin.js';
import { createPlatformAuth } from './modules/platform/auth.js';
import { createCustomerService } from './modules/platform/customers.js';
import type { PlanReader } from './modules/platform/plans.js';
import type { PlatformProviders } from './modules/platform/providers.js';
import { createPlatformSessions } from './modules/platform/session.js';
import type { WorkspaceConfigs } from './modules/settings/configs.js';
import type { Clock } from './platform/clock.js';
import type { Envelope } from './platform/crypto/envelope.js';
import type { Db } from './platform/db.js';
import type { VoiceProvider } from './voice/providers/types.js';

interface ConsoleInputs {
  env: Env;
  db: Db;
  clock: Clock;
  ai: AiRuntime;
  platform: PlatformProviders;
  plans: PlanReader;
  configs: WorkspaceConfigs;
  envelope: Envelope | null;
  envAi: ReadonlyMap<string, LlmProvider>;
  voiceProvider: VoiceProvider | null;
}

/** The super admin console (U-7): its sessions, sign-in, AI settings and customers. */
export function createPlatformConsole(c: ConsoleInputs, voiceProviderIds: readonly string[]) {
  const sessions = createPlatformSessions(c.env.JWT_SECRET, c.env.SESSION_TTL_HOURS, c.clock, c.db);
  return {
    sessions,
    auth: createPlatformAuth(c.db, sessions),
    ai: createPlatformAiAdmin({
      db: c.db,
      clock: c.clock,
      ai: c.ai,
      providers: c.platform,
      plans: c.plans,
      envelope: c.envelope,
      envAi: c.envAi,
      voiceProviderIds,
      envVoiceProvider: c.voiceProvider ? c.env.VOICE_PROVIDER : null,
      defaultVoiceModel: c.env.VOICE_MODEL,
    }),
    customers: createCustomerService({
      db: c.db,
      clock: c.clock,
      plans: c.plans,
      configs: c.configs,
    }),
  };
}

export type PlatformConsole = ReturnType<typeof createPlatformConsole>;
