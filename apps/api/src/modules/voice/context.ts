import type { Fact, TicketDraft, TranscriptLine } from '@bookleaf/shared';
import { buildAuthorFacts } from '../../ai/chat/author-facts.js';
import type { Db } from '../../platform/db.js';
import { voiceGreeting, voiceInstructions } from '../../voice/call/instructions.js';
import { VOICE_TOOLS } from '../../voice/call/tool-defs.js';
import type { VoiceSessionConfig } from '../../voice/providers/types.js';
import { loadAuthorRecord } from '../chat/repository.js';

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
  dataAsOf: Date;
  maxSeconds: number;
  thread: ThreadContext;
}

/** What the assistant may say on this call: only this author's own verified records. */
export async function buildCallContext(
  db: Db,
  { authorId, dataAsOf, maxSeconds, thread }: CallContextInput,
): Promise<CallContext> {
  const author = await loadAuthorRecord(db, authorId);
  const facts = buildAuthorFacts(author, '', dataAsOf);
  const books = author.books.map((b) => ({ id: b.id, title: b.title }));
  const firstName = author.name.split(' ')[0] ?? author.name;
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
