import type { Fact, TicketDraft, TranscriptLine } from '@bookleaf/shared';
import { loadAuthorView } from '../../host/author.js';
import type { HostRecords } from '../../host/types.js';
import type { Db } from '../../platform/db.js';
import { voiceGreeting, voiceInstructions } from '../../voice/call/instructions.js';
import { VOICE_TOOLS } from '../../voice/call/tool-defs.js';
import type { VoiceSessionConfig } from '../../voice/providers/types.js';

export interface CallContext {
  facts: Fact[];
  books: { id: string; title: string }[];
  ignorePhrases: string[];
  config: VoiceSessionConfig;
  draft: TicketDraft;
}

export interface ThreadContext {
  draft: TicketDraft;
  /** End of the earlier conversation when this call continues a dropped one. */
  earlier: TranscriptLine[];
  resumed: boolean;
}

export interface CallContextInput {
  authorId: string;
  maxSeconds: number;
  thread: ThreadContext;
}

/** What the assistant may say on this call: only this author's own verified records. */
export async function buildCallContext(
  deps: { db: Db; records: HostRecords },
  { authorId, maxSeconds, thread }: CallContextInput,
): Promise<CallContext> {
  const { facts, books, firstName } = await loadAuthorView(deps, authorId);
  const instructions = voiceInstructions({
    authorFirstName: firstName,
    books,
    facts,
    maxMinutes: Math.round(maxSeconds / 60),
    draft: thread.draft,
    earlier: thread.earlier,
  });
  return {
    facts,
    books,
    ignorePhrases: books.map((b) => b.title),
    draft: thread.draft,
    config: {
      instructions,
      tools: VOICE_TOOLS,
      language: 'en',
      greeting: voiceGreeting(firstName, thread.resumed),
    },
  };
}
