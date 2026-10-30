import type { ReplyLanguage } from '@bookleaf/shared';
import { TIME_WARNING } from './lifecycle.js';
import { workspaceNameText, type WorkspaceKnowledge } from '../../ai/knowledge/knowledge.js';
import {
  BOOKLEAF_PERSONA_WORDS,
  englishPersona,
  genericPersonaWords,
  hinglishPersona,
} from './persona-text.js';
import { TURN_LIMIT_GOODBYE } from './turn-limit.js';
import type { SpokenLines } from './types.js';

export const VOICE_STYLES = ['hinglish', 'english'] as const;
export type VoiceStyle = (typeof VOICE_STYLES)[number];

/**
 * The call's style from the customer's language setting (U-7): English → english, Hinglish and
 * "match the customer" → hinglish (it mirrors the caller's language). Unset → the server's.
 */
export function voiceStyleFor(language: ReplyLanguage | null, fallback: VoiceStyle): VoiceStyle {
  if (language === null) return fallback;
  return language === 'ENGLISH' ? 'english' : 'hinglish';
}

export type GreetingKind = 'new' | 'resumed' | 'chat';

export interface StyleLines extends SpokenLines {
  /** Fixed first words with the author's name (a free-form greeting once said "Hi, Author"). */
  greeting: Record<GreetingKind, (firstName: string) => string>;
}

const LINES: Record<VoiceStyle, StyleLines> = {
  english: {
    greeting: {
      new: (n) => `Hi ${n}, this is BookLeaf support. How can I help with your books today?`,
      resumed: (n) => `Welcome back ${n}, let's pick up where we left off.`,
      chat: (n) => `Hi ${n}, I can see our chat so far. What would you like to talk through?`,
    },
    timeWarning: TIME_WARNING,
    turnLimitGoodbye: TURN_LIMIT_GOODBYE,
  },
  hinglish: {
    greeting: {
      new: (n) =>
        `Namaste ${n} ji, main BookLeaf support se bol rahi hoon. Bataiye, aaj aapki books ke baare mein kaise help karoon?`,
      resumed: (n) =>
        `Welcome back ${n} ji. Chaliye, wahin se continue karte hain jahan humne chhoda tha.`,
      chat: (n) =>
        `Hi ${n} ji, maine humari chat dekh li hai. Bataiye, kis baare mein baat karni hai?`,
    },
    timeWarning: 'Bas ek chhota sa heads-up, is call mein about thirty seconds bache hain.',
    turnLimitGoodbye:
      'Is conversation ki message limit poori ho gayi hai, isliye main yahin rukti hoon. Aap kabhi bhi ek new conversation shuru kar sakte hain. Dhanyavaad ji, take care!',
  },
};

/** Who the call is for: BookLeaf's own wording runs only with its publishing pack (S.9). */
export type VoiceBrand = Pick<WorkspaceKnowledge, 'publishingPack' | 'workspaceName'>;

/** The first greeting of a new call for any workspace without the publishing pack. */
const GENERIC_NEW_GREETING: Record<VoiceStyle, (firstName: string, company: string) => string> = {
  english: (n, c) => `Hi ${n}, this is ${c} support. How can I help today?`,
  hinglish: (n, c) =>
    `Namaste ${n} ji, main ${c} support se bol rahi hoon. Bataiye, aaj main aapki kaise help karoon?`,
};

/** The fixed things the assistant says in this style: greetings, the time warning, the limit goodbye. */
export function spokenLines(style: VoiceStyle, brand: VoiceBrand): StyleLines {
  const lines = LINES[style];
  if (brand.publishingPack) return lines;
  const company = workspaceNameText(brand);
  const newCall = (n: string) => GENERIC_NEW_GREETING[style](n, company);
  return { ...lines, greeting: { ...lines.greeting, new: newCall } };
}

/** How the assistant sounds: personality, language, tone, pacing and fillers. */
export function personaBlock(style: VoiceStyle, brand: VoiceBrand): string {
  const words = brand.publishingPack
    ? BOOKLEAF_PERSONA_WORDS
    : genericPersonaWords(workspaceNameText(brand));
  return style === 'hinglish' ? hinglishPersona(words) : englishPersona(words);
}

/**
 * The language the speech service transcribes in. Hinglish is left to automatic detection, so
 * Hindi words are not forced into English spellings.
 */
export const transcriptionLanguage = (style: VoiceStyle): string | null =>
  style === 'hinglish' ? null : 'en';
