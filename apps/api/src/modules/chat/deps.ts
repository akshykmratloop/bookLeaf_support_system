import type { KeyedQueue, KeyedQueues, RateCounters } from '../../platform/shared-state/types.js';
import type { AssistantService } from '../assistant/service.js';
import type { TicketDeps } from '../tickets/deps.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';

/** What the chat module needs from the rest of the app. */
export interface ChatDeps extends TicketDeps {
  assistant: AssistantService;
  drafts: TicketDraftService;
  /** Shared by every copy of the API, so one conversation is answered in order everywhere. */
  queues: KeyedQueues;
  /** Shared message counters, so an author's limits hold across every copy and every chat. */
  counters: RateCounters;
}

/** Chat deps plus the per-conversation queue the service owns. */
export interface ChatContext extends ChatDeps {
  inOrder: KeyedQueue;
}
