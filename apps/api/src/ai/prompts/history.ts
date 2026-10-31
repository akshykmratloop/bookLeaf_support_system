/**
 * How much of a ticket's conversation goes to the model (cost caps). The description is always
 * the first author message; later ones are kept newest first up to a small limit.
 */
export const MAX_TRIAGE_DESCRIPTION_CHARS = 6000;
/** Triage reads the description and the last few follow-ups. */
export const TRIAGE_FOLLOW_UPS = 3;
/** A draft reads the latest message in full and this many earlier ones (truncated). */
export const DRAFT_EARLIER_MESSAGES = 6;

/** The description plus the last TRIAGE_FOLLOW_UPS author messages, oldest first. */
export function triageHistory(authorMessages: readonly string[]): string {
  const [description = '', ...followUps] = authorMessages;
  return [description, ...followUps.slice(-TRIAGE_FOLLOW_UPS)].join('\n\n');
}
