import type { VoiceStyle } from '../../voice/call/persona.js';
import type { VoiceProvider } from '../../voice/providers/types.js';
import type { AssistantService } from '../assistant/service.js';
import type { DraftLiveUpdates } from '../ticket-drafts/live.js';
import type { TicketDraftService } from '../ticket-drafts/service.js';
import type { TicketDeps } from '../tickets/deps.js';

/** What the voice module needs from the rest of the app. */
export interface VoiceDeps extends TicketDeps {
  assistant: AssistantService;
  /** The workspace's speech provider; null when it has none: voice is then unavailable. */
  voiceFor: (workspaceId: string) => Promise<VoiceProvider | null>;
  drafts: TicketDraftService;
  live: DraftLiveUpdates;
  /** How the assistant speaks on calls (VOICE_STYLE). */
  voiceStyle: VoiceStyle;
}
