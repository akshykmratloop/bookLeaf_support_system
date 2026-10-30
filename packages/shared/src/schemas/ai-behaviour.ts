import { z } from 'zod';
import { cleanText } from '../sanitize.js';

/**
 * How a customer's AI writes and speaks (U-7): set by the customer in Workspace Settings and
 * used by triage, reply drafts, chat and voice. Null choices mean "not chosen": the AI behaves
 * as it always did. Safety rules (the reply checker, [CONFIRM: …] placeholders, guardrails) are
 * the platform's and never customer-editable.
 */
export const REPLY_LANGUAGES = ['ENGLISH', 'HINGLISH', 'MATCH'] as const;
export type ReplyLanguage = (typeof REPLY_LANGUAGES)[number];
export const REPLY_LENGTHS = ['SHORT', 'MEDIUM', 'DETAILED'] as const;
export type ReplyLength = (typeof REPLY_LENGTHS)[number];
export const REPLY_FORMALITIES = ['FORMAL', 'NEUTRAL', 'FRIENDLY'] as const;
export type ReplyFormality = (typeof REPLY_FORMALITIES)[number];
export const WIDGET_THEMES = ['AUTO', 'LIGHT', 'DARK'] as const;
export type WidgetTheme = (typeof WIDGET_THEMES)[number];

export const REPLY_LANGUAGE_LABEL: Record<ReplyLanguage, string> = {
  ENGLISH: 'English',
  HINGLISH: 'Hinglish',
  MATCH: 'Match the customer',
};
export const REPLY_LENGTH_LABEL: Record<ReplyLength, string> = {
  SHORT: 'Short',
  MEDIUM: 'Medium',
  DETAILED: 'Detailed',
};
export const REPLY_FORMALITY_LABEL: Record<ReplyFormality, string> = {
  FORMAL: 'Formal',
  NEUTRAL: 'Neutral',
  FRIENDLY: 'Friendly',
};

/** One topic the AI must not discuss: short plain text. */
export const TopicSchema = cleanText(2, 80);
export const MAX_TOPICS = 10;

/** The AI behaviour fields as the API returns them. */
export const AiBehaviourSchema = z.object({
  toneGuide: z.string(),
  greeting: z.string(),
  signature: z.string(),
  replyLanguage: z.enum(REPLY_LANGUAGES).nullable(),
  replyLength: z.enum(REPLY_LENGTHS).nullable(),
  formality: z.enum(REPLY_FORMALITIES).nullable(),
  topicsToAvoid: z.array(z.string()),
});
export type AiBehaviour = z.infer<typeof AiBehaviourSchema>;

/** Nothing chosen: the AI behaves as before U-7. */
export const DEFAULT_AI_BEHAVIOUR: AiBehaviour = {
  toneGuide: '',
  greeting: '',
  signature: '',
  replyLanguage: null,
  replyLength: null,
  formality: null,
  topicsToAvoid: [],
};
