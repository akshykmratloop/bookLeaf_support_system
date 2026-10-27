import { ForbiddenError } from '../../platform/errors.js';
import type { keyedQueue } from '../../platform/keyed-queue.js';
import type { AssistantLimits } from '../assistant/limits.js';
import type { AssistantService } from '../assistant/service.js';
import type { Session } from '../auth/session.js';
import type { TicketDeps } from '../tickets/deps.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';

/** What the chat module needs from the rest of the app. */
export interface ChatDeps extends TicketDeps {
  assistant: AssistantService;
  drafts: TicketDraftService;
  limits: AssistantLimits;
}

/** Chat deps plus the per-conversation queue the service owns. */
export interface ChatContext extends ChatDeps {
  inOrder: ReturnType<typeof keyedQueue>;
}

export function authorIdOf(session: Session): string {
  if (session.role !== 'AUTHOR' || !session.authorId)
    throw new ForbiddenError('Only authors can use the chat');
  return session.authorId;
}
