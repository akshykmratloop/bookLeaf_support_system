import { PRIORITY_RANK, type Priority, type TicketCategory } from '@bookleaf/shared';
import type { BookRoyaltyStatus } from '../facts/index.js';

export interface FloorInput {
  text: string;
  category: TicketCategory;
  royaltyStatus: BookRoyaltyStatus | null;
}

export interface PriorityFloor {
  floor: Priority;
  reasons: string[];
}

interface FloorRule {
  applies: (input: FloorInput) => boolean;
  floor: Priority;
  reason: string;
}

const ISBN_ERROR =
  /\bisbn\b[\s\S]{0,80}\b(wrong|different|duplicate|mismatch|incorrect|another|not match)/i;
const ISBN_ERROR_REVERSED =
  /\b(wrong|different|duplicate|mismatch(ed)?|incorrect)\b[\s\S]{0,40}\bisbn\b/i;
const LEGAL = /\b(lawyer|legal (?:action|notice)|consumer (?:court|forum)|sue|police complaint)\b/i;
const LONG_UNPAID =
  /\b(?:no|not|never|haven'?t)\b[\s\S]{0,60}\broyalt(?:y|ies)\b[\s\S]{0,60}\b([6-9]|1[0-9]|six|seven|eight|nine|ten|twelve)\s+months?\b/i;

/**
 * Business rules that set a minimum priority regardless of what the model says.
 * They come from the Knowledge Base (ISBN errors are high priority) and from the royalty facts.
 */
const RULES: readonly FloorRule[] = [
  {
    applies: (i) => ISBN_ERROR.test(i.text) || ISBN_ERROR_REVERSED.test(i.text),
    floor: 'HIGH',
    reason: 'ISBN error: high priority per policy',
  },
  {
    applies: (i) => i.royaltyStatus === 'POSSIBLY_OVERDUE' && i.category === 'ROYALTY_PAYMENTS',
    floor: 'HIGH',
    reason: 'Records show no payout although a payout deadline has passed',
  },
  {
    applies: (i) => LONG_UNPAID.test(i.text),
    floor: 'HIGH',
    reason: 'Author reports no royalty for 6+ months',
  },
  { applies: (i) => LEGAL.test(i.text), floor: 'HIGH', reason: 'Mentions legal action' },
];

export function higherPriority(a: Priority, b: Priority): Priority {
  return PRIORITY_RANK[a] <= PRIORITY_RANK[b] ? a : b;
}

export function priorityFloor(input: FloorInput): PriorityFloor {
  const hits = RULES.filter((r) => r.applies(input));
  return {
    floor: hits.reduce<Priority>((acc, r) => higherPriority(acc, r.floor), 'LOW'),
    reasons: hits.map((r) => r.reason),
  };
}
