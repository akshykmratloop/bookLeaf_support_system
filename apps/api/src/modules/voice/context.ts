import type { AssistantLimits } from '../assistant/limits.js';
import type { Fact, TicketDraft, TranscriptLine } from '@bookleaf/shared';
import { loadAuthorView } from '../../host/author.js';
import type { HostRecords } from '../../host/types.js';
import type { Db } from '../../platform/db.js';
import { voiceInstructions } from '../../voice/call/instructions.js';
import {
  spokenLines,
  transcriptionLanguage,
  voiceStyleFor,
  type VoiceStyle,
} from '../../voice/call/persona.js';
import { greetingFor } from '../../ai/prompts/behaviour.js';
import type { SpokenLines } from '../../voice/call/types.js';
import { voiceTools } from '../../voice/call/tool-defs.js';
import type { VoiceSessionConfig } from '../../voice/providers/types.js';
import type { WorkspaceKnowledge } from '../../ai/knowledge/knowledge.js';
import { loadWorkspaceKnowledge } from '../categories/load-knowledge.js';

export interface CallContext {
  facts: Fact[];
  books: { id: string; title: string }[];
  ignorePhrases: string[];
  /** The workspace's categories (issue types the draft may use) and articles. */
  knowledge: WorkspaceKnowledge;
  config: VoiceSessionConfig;
  draft: TicketDraft;
  /** Author messages the chat this call joins still allows; null when it is not in a chat. */
  turnsLeft: number | null;
  /** The time warning and limit goodbye, in the call's voice style. */
  lines: SpokenLines;
  /** The workspace's limits the call runs under. */
  limits: AssistantLimits;
}

export interface ThreadContext {
  draft: TicketDraft;
  /** End of the earlier conversation: the chat the call joins, or a dropped call it continues. */
  earlier: TranscriptLine[];
  from: 'chat' | 'call';
  resumed: boolean;
}

export interface CallContextInput {
  authorId: string;
  workspaceId: string;
  maxSeconds: number;
  thread: ThreadContext;
  turnsLeft: number | null;
  style: VoiceStyle;
  limits: AssistantLimits;
  /** The workspace's chosen voice. */
  voiceName: string;
}

const greetingKind = (t: ThreadContext) =>
  !t.resumed ? 'new' : t.from === 'chat' ? 'chat' : 'resumed';

/** A new call opens with the customer's own greeting when it set one (U-7). */
function openingLine(k: WorkspaceKnowledge, t: ThreadContext, style: VoiceStyle, name: string) {
  const kind = greetingKind(t);
  const own = kind === 'new' ? greetingFor(k.behaviour, name) : null;
  return own ?? spokenLines(style, k).greeting[kind](name);
}

/** What the assistant may say on this call: only this author's own verified records. */
export async function buildCallContext(
  deps: { db: Db; records: HostRecords },
  input: CallContextInput,
): Promise<CallContext> {
  const { authorId, maxSeconds, thread, turnsLeft, limits, voiceName } = input;
  const [{ facts, books, firstName }, knowledge] = await Promise.all([
    loadAuthorView(deps, authorId),
    loadWorkspaceKnowledge(deps.db, input.workspaceId),
  ]);
  // The customer's language choice picks the voice style; unset keeps VOICE_STYLE (U-7).
  const style = voiceStyleFor(knowledge.behaviour?.replyLanguage ?? null, input.style);
  const instructions = voiceInstructions({
    knowledge,
    authorFirstName: firstName,
    books,
    facts,
    maxMinutes: Math.round(maxSeconds / 60),
    draft: thread.draft,
    earlier: thread.earlier,
    earlierFrom: thread.from,
    style,
  });
  const { greeting: _greetings, ...lines } = spokenLines(style, knowledge);
  return {
    facts,
    books,
    ignorePhrases: books.map((b) => b.title),
    knowledge,
    draft: thread.draft,
    turnsLeft,
    lines,
    limits,
    config: {
      instructions,
      tools: voiceTools(knowledge),
      language: transcriptionLanguage(style),
      greeting: openingLine(knowledge, thread, style, firstName),
      voice: voiceName,
    },
  };
}
