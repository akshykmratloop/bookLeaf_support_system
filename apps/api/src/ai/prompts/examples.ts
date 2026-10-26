import type { TicketCategory } from '@bookleaf/shared';

/** The brief's sample query → expected response guidance, one or two per category. */
interface Example {
  query: string;
  guidance: string;
}

export const EXAMPLES: Record<TicketCategory, Example[]> = {
  ROYALTY_PAYMENTS: [
    {
      query: "I published my book 4 months ago and still haven't received any royalty. What's going on?",
      guidance:
        'Acknowledge the frustration. Explain the quarterly cycle and 45-day payout window. Check if bank details are linked. Give the specific next payout date. If genuinely overdue, escalate with a 48-hour resolution timeline.',
    },
    {
      query: 'My royalty amount seems too low. I sold 200 copies but only received ₹3,000.',
      guidance:
        'Explain net profit: MRP minus printing, platform commission and shipping. Offer a line-by-line royalty breakdown. Not defensive; offer transparency.',
    },
  ],
  ISBN_METADATA: [
    {
      query: "My book is showing a different ISBN on Amazon than what's on the physical copy.",
      guidance:
        'Treat as high priority. Acknowledge it is a serious data issue. Confirm escalation to the production team immediately. Give a 48-hour resolution timeline.',
    },
  ],
  PRINTING_QUALITY: [
    {
      query: 'I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.',
      guidance:
        'Apologise sincerely. Ask for photos of the defective copies. Confirm a free reprint once verified. Give 5–7 business days for the reprint.',
    },
  ],
  DISTRIBUTION_AVAILABILITY: [
    {
      query: "My book is published but it's showing as 'Currently Unavailable' on Amazon.",
      guidance:
        'Explain this is typically a stock sync issue. Confirm a re-sync is being triggered with the distribution team. Expect 24–48 hours for it to go live again.',
    },
  ],
  BOOK_STATUS_PRODUCTION: [
    {
      query: "It's been 3 weeks and my book is still in typesetting. When will it be done?",
      guidance:
        "Check the actual production status. If delayed, be honest about why (e.g. waiting on author approval of proofs). Give a specific updated timeline. Don't blame the author even if the delay is on their side; frame it collaboratively.",
    },
  ],
  GENERAL_INQUIRY: [
    {
      query: "Can I update the description of my book on Amazon after it's already live?",
      guidance:
        'Yes: metadata updates can be submitted through the dashboard or by emailing the BookLeaf team. Changes typically reflect within 3–5 business days.',
    },
  ],
};

export function examplesText(category: TicketCategory): string {
  return EXAMPLES[category].map((e, i) => `Example ${i + 1}\nAuthor: ${e.query}\nHow to respond: ${e.guidance}`).join('\n\n');
}
