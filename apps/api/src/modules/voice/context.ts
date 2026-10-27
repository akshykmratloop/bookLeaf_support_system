import type { Fact, TicketDraft, TranscriptLine } from '@bookleaf/shared';
import { loadAuthorView } from '../../host/author.js';
import type { HostRecords } from '../../host/types.js';
import type { Db } from '../../platform/db.js';
import { voiceInstructions } from '../../voice/call/instructions.js';
import { spokenLines, transcriptionLanguage, type VoiceStyle } from '../../voice/call/persona.js';
import type { SpokenLines } from '../../voice/call/types.js';
import { VOICE_TOOLS } from '../../voice/call/tool-defs.js';
import type { VoiceSessionConfig } from '../../voice/providers/types.js';

export interface CallContext {
  facts: Fact[];
  books: { id: string; title: string }[];
  ignorePhrases: string[];
  config: VoiceSessionConfig;
  draft: TicketDraft;
  /** Author messages the chat this call joins still allows; null when it is not in a chat. */
  turnsLeft: number | null;
  /** The time warning and limit goodbye, in the call's voice style. */
  lines: SpokenLines;
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
  maxSeconds: number;
  thread: ThreadContext;
  turnsLeft: number | null;
  style: VoiceStyle;
}

const greetingFor = (t: ThreadContext) =>
  !t.resumed ? 'new' : t.from === 'chat' ? 'chat' : 'resumed';

/** What the assistant may say on this call: only this author's own verified records. */
export async function buildCallContext(
  deps: { db: Db; records: HostRecords },
  { authorId, maxSeconds, thread, turnsLeft, style }: CallContextInput,
): Promise<CallContext> {
  const { facts, books, firstName } = await loadAuthorView(deps, authorId);
  const instructions = voiceInstructions({
    authorFirstName: firstName,
    books,
    facts,
    maxMinutes: Math.round(maxSeconds / 60),
    draft: thread.draft,
    earlier: thread.earlier,
    earlierFrom: thread.from,
    style,
  });
  const { greeting, ...lines } = spokenLines(style);
  return {
    facts,
    books,
    ignorePhrases: books.map((b) => b.title),
    draft: thread.draft,
    turnsLeft,
    lines,
    config: {
      instructions,
      tools: VOICE_TOOLS,
      language: transcriptionLanguage(style),
      greeting: greeting[greetingFor(thread)](firstName),
    },
  };
}
