import type { Fact } from '@bookleaf/shared';
import type { WorkspaceKnowledge } from '../knowledge/knowledge.js';
import type { RoyaltySignals } from '../domain/signals.js';

export interface DraftBook {
  externalId: string;
  title: string;
}

export interface DraftInput {
  /** The ticket's category key (null: not categorised yet). */
  category: string | null;
  /** The ticket's workspace's categories and articles: drafts use only the linked articles. */
  knowledge: WorkspaceKnowledge;
  authorName: string;
  book: DraftBook | null;
  facts: readonly Fact[];
  royalty: RoyaltySignals;
  subject: string;
  /** Original description first, then later author messages. */
  authorMessages: string[];
  lastTeamReply: string | null;
  /** Book titles across the author's catalogue: their digits are not claims. */
  ignorePhrases: string[];
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
export const SIGN_OFF = 'Warm regards,\nBookLeaf Author Support';

/** BookLeaf keeps its own sign-off; any other workspace signs as its own support team. */
export const signOffFor = (k: WorkspaceKnowledge) =>
  k.publishingPack
    ? SIGN_OFF
    : `Warm regards,\n${k.workspaceName.replace(/\s+/g, ' ').trim()} Support`;
