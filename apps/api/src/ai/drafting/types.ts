import type { Fact, TicketCategory } from '@bookleaf/shared';
import type { RoyaltySignals } from '../domain/signals.js';

export interface DraftBook {
  externalId: string;
  title: string;
}

export interface DraftInput {
  category: TicketCategory;
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
  /** The workspace admin's style notes for replies (empty: none). */
  toneGuide?: string;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
export const SIGN_OFF = 'Warm regards,\nBookLeaf Author Support';
