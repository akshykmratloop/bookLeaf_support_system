import { ForbiddenError } from '../../platform/errors.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import type { AssistantLimits } from '../assistant/limits.js';
import type { AssistantService } from '../assistant/service.js';
import type { Session } from '../auth/session.js';
import type { DraftLiveUpdates } from '../ticket-drafts/live.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';
import type { TicketDeps } from '../tickets/deps.js';

/** What the voice module needs from the rest of the app. */
export interface VoiceDeps extends TicketDeps {
  assistant: AssistantService;
  limits: AssistantLimits;
  /** Null when no speech provider is configured: voice is then unavailable. */
  provider: VoiceProvider | null;
  drafts: TicketDraftService;
  live: DraftLiveUpdates;
}

export function authorIdOf(session: Session): string {
  if (session.role !== 'AUTHOR' || !session.authorId)
    throw new ForbiddenError('Only authors can make voice calls');
  return session.authorId;
}
