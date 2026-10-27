import type { Fact } from '@bookleaf/shared';
import { buildAuthorFacts } from '../../ai/chat/author-facts.js';
import type { Db } from '../../platform/db.js';
import { VOICE_TOOLS, voiceGreeting, voiceInstructions } from '../../voice/call/instructions.js';
import type { VoiceSessionConfig } from '../../voice/providers/types.js';
import { loadAuthorRecord } from '../chat/repository.js';

export interface CallContext {
  facts: Fact[];
  books: { id: string; title: string }[];
  ignorePhrases: string[];
  config: VoiceSessionConfig;
}

/** What the assistant may say on this call: only this author's own verified records. */
export async function buildCallContext(
  db: Db,
  authorId: string,
  dataAsOf: Date,
  maxSeconds: number,
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
  });
  return {
    facts,
    books,
    ignorePhrases: books.map((b) => b.title),
    config: {
      instructions,
      tools: VOICE_TOOLS,
      language: 'en',
      greeting: voiceGreeting(firstName),
    },
  };
}
