import type { UpdateAssistantSettings } from '@bookleaf/shared';
import { FeatureDisabledError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { adminStatus, availability, chatAccess } from './availability.js';
import { loadSettings, type AssistantDeps } from './deps.js';
import { updateSettings } from './update-settings.js';

export type { ChatAccess } from './availability.js';

/** Admin switches for the author chat and voice calls, checked on every request. */
export function createAssistantService(deps: AssistantDeps) {
  const settings = () => loadSettings(deps.db);
  return {
    settings,
    availability: () => availability(deps),
    chatAccess: () => chatAccess(deps),
    /** Server-side gate for every chat endpoint: the admin switch is checked on each request. */
    async requireChatEnabled(): Promise<void> {
      if (!(await settings()).chatEnabled) throw new FeatureDisabledError('Ask BookLeaf chat');
    },
    async requireVoiceEnabled(): Promise<void> {
      if (!(await settings()).voiceEnabled) throw new FeatureDisabledError('Voice support');
    },
    adminStatus: () => adminStatus(deps),
    update: (s: Session, input: UpdateAssistantSettings) => updateSettings(deps, s, input),
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
