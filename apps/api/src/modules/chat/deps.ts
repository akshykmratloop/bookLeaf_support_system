import type { keyedQueue } from '../../platform/keyed-queue.js';
import type { AssistantService } from '../assistant/service.js';
import type { TicketDeps } from '../tickets/deps.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';

/** What the chat module needs from the rest of the app. */
export interface ChatDeps extends TicketDeps {
  assistant: AssistantService;
  drafts: TicketDraftService;
}

/** Chat deps plus the per-conversation queue the service owns. */
export interface ChatContext extends ChatDeps {
  inOrder: ReturnType<typeof keyedQueue>;
}
