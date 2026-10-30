export interface ReplyBoxCopy {
  label: string;
  note: string;
  placeholder: string;
  sent: string;
}

/**
 * Words for the author's ticket reply box. It names the company's team and says a person answers,
 * so it is not mistaken for the AI chat (ticket replies work even when chat is switched off).
 */
export function replyBoxCopy(brandName: string | undefined): ReplyBoxCopy {
  const name = brandName?.trim();
  const team = name ? `the ${name} team` : 'the support team';
  return {
    label: `Reply to ${team}`,
    note: 'A person from the team reads and answers this ticket. This is not the live chat.',
    placeholder: 'Write your reply to the team…',
    sent: `Reply sent to ${team}`,
  };
}
