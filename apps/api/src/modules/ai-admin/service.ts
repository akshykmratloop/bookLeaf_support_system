import type { AiStatus, UpdateAiSettings } from '@bookleaf/shared';
import type { Session } from '../auth/session.js';
import { aiStatus, testProvider } from './ai-status.js';
import type { AiAdminDeps } from './deps.js';
import { updateAiSettings } from './update-ai-settings.js';

/** Admin control of the AI provider and models; API keys stay in env and are never returned. */
export function createAiAdminService(deps: AiAdminDeps) {
  // The last connection test is shown on the settings screen until the next one.
  let lastTest: AiStatus['lastTest'] = null;
  return {
    status: () => aiStatus(deps, lastTest),
    update: (s: Session, input: UpdateAiSettings) => updateAiSettings(deps, s, input),
    async test() {
      const result = await testProvider(deps);
      lastTest = { ...result, at: deps.clock.now().toISOString() };
      return result;
    },
  };
}

export type AiAdminService = ReturnType<typeof createAiAdminService>;
