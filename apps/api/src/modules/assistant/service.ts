import type { UpdateAssistantSettings } from '@bookleaf/shared';
import { FeatureDisabledError } from '../../platform/errors.js';
import type { Session } from '../auth/session.js';
import { adminStatus, availability, chatAccess } from './availability.js';
import { type AssistantDeps } from './deps.js';
import { updateSettings } from './update-settings.js';

export type { ChatAccess } from './availability.js';

/** Each workspace's switches for the author chat and voice calls, checked on every request. */
export function createAssistantService(deps: AssistantDeps) {
  const config = (workspaceId: string) => deps.configs.forWorkspace(workspaceId);
  return {
    config,
    availability: (workspaceId: string) => availability(deps, workspaceId),
    chatAccess: (workspaceId: string) => chatAccess(deps, workspaceId),
    /** Server-side gate for every chat endpoint: the switch is checked on each request. */
    async requireChatEnabled(workspaceId: string): Promise<void> {
      if (!(await config(workspaceId)).chatEnabled)
        throw new FeatureDisabledError('Ask BookLeaf chat');
    },
    async requireVoiceEnabled(workspaceId: string): Promise<void> {
      if (!(await config(workspaceId)).voiceEnabled)
        throw new FeatureDisabledError('Voice support');
    },
    adminStatus: (session: Session) => adminStatus(deps, session),
    update: (s: Session, input: UpdateAssistantSettings) => updateSettings(deps, s, input),
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
