import type { Fact, TicketCategory } from '@bookleaf/shared';
import { firstName, SIGN_OFF, type DraftInput } from './types.js';

/**
 * Fallback replies used when AI is unavailable. Every figure is filled in by code from the
 * facts pack, and anything not in the data becomes a [CONFIRM: …] placeholder for the agent.
 */
const show = (facts: readonly Fact[], id: string): string | null => {
  const f = facts.find((x) => x.id === id);
  return f && f.type !== 'UNKNOWN' ? f.display : null;
};

/** A policy figure from the workspace's knowledge-base facts, or a question for the agent. */
const kb = (facts: readonly Fact[], id: string, what: string) =>
  show(facts, `kb.${id}`) ?? `[CONFIRM: ${what}]`;

interface RoyaltyWords {
  total: string;
  deadline: string;
  pending: string | null;
  title: string;
}

function royaltyWords({ facts, book }: DraftInput): RoyaltyWords {
  return {
    total: show(facts, 'author.total_pending') ?? '[CONFIRM: total pending]',
    deadline: show(facts, 'payout.next_cycle_deadline') ?? '[CONFIRM: next payout date]',
    pending: book ? show(facts, `book.${book.externalId}.royalty_pending`) : null,
    title: book?.title ?? 'your books',
  };
}

function nothingPendingText(input: DraftInput, w: RoyaltyWords): string {
  const others =
    (input.royalty.authorTotalPendingPaise ?? 0) > 0
      ? ` You do have ${w.total} pending across your other books, due in the payout cycle that closes by ${w.deadline}.`
      : '';
  return `${w.title} has no royalty pending at the moment.${others}`;
}

function totalOnlyText(input: DraftInput, w: RoyaltyWords): string {
  const total = `Your total pending royalty across your books is ${w.total}`;
  if (input.royalty.payoutEligible === null)
    return `${total}. [CONFIRM: is it above the payout minimum?]`;
  return input.royalty.payoutEligible
    ? `${total}, due in the payout cycle that closes by ${w.deadline}.`
    : `${total}, below the ${kb(input.facts, 'payout_threshold', 'minimum payout')} minimum payout, so it rolls over to the next quarter.`;
}

function belowThresholdText(input: DraftInput, w: RoyaltyWords): string {
  const minimum = kb(input.facts, 'payout_threshold', 'minimum payout');
  return `Your total pending royalty across your books is ${w.total}. This is below the ${minimum} minimum payout, so it rolls over to the next quarter and will be paid once your total reaches ${minimum}.`;
}

function royaltyParagraph(input: DraftInput): string {
  const w = royaltyWords(input);
  switch (input.royalty.bookStatus) {
    case 'POSSIBLY_OVERDUE':
      return `Our records show ${w.pending} pending on ${w.title} and no payout recorded, although a payout deadline has passed. That should not have happened, and I have escalated it to our royalties team. Our team will look into this and get back to you within ${kb(input.facts, 'escalation_window', 'escalation reply time')}.`;
    case 'BELOW_THRESHOLD':
      return belowThresholdText(input, w);
    case 'SCHEDULED':
      return `${w.title} has ${w.pending} pending. Your total pending across your books is ${w.total}, which is due in the payout cycle that closes by ${w.deadline}.`;
    case 'NOTHING_PENDING':
      return nothingPendingText(input, w);
    default:
      return totalOnlyText(input, w);
  }
}

const BODIES: Record<TicketCategory, (input: DraftInput) => string> = {
  ROYALTY_PAYMENTS: (i) =>
    `Thank you for reaching out about your royalties, and I'm sorry for the worry this has caused.

${royaltyParagraph(i)}

Royalties are calculated quarterly and paid within ${kb(i.facts, 'payout_window', 'payout window')} of the quarter ending, by bank transfer to the account linked in your dashboard. [CONFIRM: is the author's bank account linked?]

If you would like a line-by-line breakdown of your royalty, just reply here and we will share it.`,
  ISBN_METADATA: (i) =>
    `Thank you for flagging this, and I'm sorry for the trouble. An ISBN or metadata error is a serious data issue and we treat it as a high priority.${i.book ? ` Our records list the ISBN for ${i.book.title} as ${show(i.facts, `book.${i.book.externalId}.isbn`) ?? '[CONFIRM: ISBN]'}.` : ''}

I have escalated this to our production team, and we will get back to you within ${kb(i.facts, 'escalation_window', 'escalation reply time')} with a resolution. If you can, please reply with a link or screenshot of the listing that shows the incorrect details.`,
  PRINTING_QUALITY: (i) =>
    `I'm truly sorry that your copies did not arrive in the condition you expected.

Could you please reply with a few photos of the defective pages or binding? Once our team verifies the issue, BookLeaf will arrange a free reprint, which typically takes ${kb(i.facts, 'print_turnaround', 'reprint turnaround')} from confirmation.`,
  DISTRIBUTION_AVAILABILITY: (i) =>
    `Thank you for letting us know, and I understand how frustrating it is to see your book unavailable.

This is usually a stock sync issue between BookLeaf and the platform. I have asked our distribution team to trigger a re-sync, and the listing should be available again within ${kb(i.facts, 'resync_window', 're-sync time')}.${i.book ? ` [CONFIRM: is ${i.book.title} currently live on the platform the author mentioned?]` : ''}`,
  BOOK_STATUS_PRODUCTION: (i) => {
    if (!i.book)
      return 'Thank you for checking in on your book. [CONFIRM: which book and its current stage]';
    const id = `book.${i.book.externalId}`;
    const delay = show(i.facts, `${id}.delay_point`);
    return `Thank you for checking in on ${i.book.title}, and I completely understand wanting to see it move forward.

${i.book.title} is currently at the ${show(i.facts, `${id}.stage`) ?? '[CONFIRM: stage]'} stage. The stages still to come are: ${show(i.facts, `${id}.remaining_stages`) ?? 'none'}.${delay ? ` ${delay}.` : ''}

[CONFIRM: expected completion date for the current stage] We will keep you updated by email at each stage.`;
  },
  GENERAL_INQUIRY: () => `Thank you for your question.

[CONFIRM: answer to the author's question]

Please reply here if there is anything else we can help with.`,
};

export function templateBody(input: DraftInput): string {
  return `Hi ${firstName(input.authorName)},

${BODIES[input.category](input)}

${SIGN_OFF}`;
}
