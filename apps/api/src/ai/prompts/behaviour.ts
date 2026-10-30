import type { AiBehaviour, ReplyFormality, ReplyLanguage, ReplyLength } from '@bookleaf/shared';

/**
 * A customer's AI behaviour settings (U-7) as prompt text. Style only: the block says so, sits
 * after the platform's rules and never replaces them, and its admin-written text is kept on safe
 * lines (no angle brackets, so it cannot close a tag). Nothing chosen → no text at all, so a
 * customer that never touched the settings gets exactly the prompts it had before.
 */
export type BehaviourTask = 'triage' | 'draft' | 'chat' | 'voice';

/** Admin text on one line, without characters that could open or close a prompt tag. */
const oneLine = (text: string) => text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

const LANGUAGE: Record<ReplyLanguage, { text: string; voice: string }> = {
  ENGLISH: { text: 'Write in clear, simple English.', voice: 'Speak clear, simple English.' },
  HINGLISH: {
    text: 'Write in natural Hinglish: everyday Hindi and English mixed, in Latin script, always respectful ("aap").',
    voice: 'Speak natural Hinglish, always respectful ("aap").',
  },
  MATCH: {
    text: 'Reply in the language the customer writes in (English, Hindi or Hinglish); if unsure, use English.',
    voice:
      'Answer in the language the customer uses (English, Hindi or Hinglish), and switch when they switch.',
  },
};

const LENGTH: Record<ReplyLength, string> = {
  SHORT: 'Keep replies short: the fewest sentences that fully answer.',
  MEDIUM: 'Keep replies to a moderate length.',
  DETAILED: 'Give detailed, complete replies that explain each step.',
};

const FORMALITY: Record<ReplyFormality, string> = {
  FORMAL: 'Use a formal, professional register.',
  NEUTRAL: 'Use a neutral, polite register.',
  FRIENDLY: 'Use a warm, friendly, conversational register.',
};

const AVOID: Record<Exclude<BehaviourTask, 'triage'>, string> = {
  draft: 'do not discuss them; say the team will follow up on that part',
  chat: 'say politely that you cannot help with that here and offer a ticket for the team',
  voice: 'say politely that you cannot help with that on this call and offer a ticket for the team',
};

const topicsOf = (b: AiBehaviour) => b.topicsToAvoid.map(oneLine).filter(Boolean);

/** The first line of a reply or call, with {name} filled in; null when none is set. */
export function greetingFor(b: AiBehaviour | undefined, firstName: string): string | null {
  const text = oneLine(b?.greeting ?? '');
  return text ? text.replaceAll('{name}', oneLine(firstName)) : null;
}

/** How reply drafts sign off; null when none is set (the default sign-off is kept). */
export function signatureFor(b: AiBehaviour | undefined): string | null {
  const text = (b?.signature ?? '').replace(/[<>]/g, '').trim();
  return text || null;
}

function triageBlock(b: AiBehaviour): string {
  const lines: string[] = [];
  if (b.replyLanguage === 'HINGLISH' || b.replyLanguage === 'MATCH')
    lines.push(
      '- Tickets may be written in Hinglish or Hindi: classify them exactly as English ones.',
    );
  const topics = topicsOf(b);
  if (topics.length)
    lines.push(
      `- Topics this company does not discuss: ${topics.join('; ')}. When a ticket asks about one, add the priority reason "Asks about a topic the company does not discuss".`,
    );
  return lines.length ? `\n\nCUSTOMER SETTINGS (classification only):\n${lines.join('\n')}` : '';
}

function styleLines(b: AiBehaviour, task: Exclude<BehaviourTask, 'triage'>): string[] {
  const lines: string[] = [];
  const tone = oneLine(b.toneGuide);
  if (tone) lines.push(`- Tone and brand voice: ${tone}`);
  if (b.replyLanguage)
    lines.push(
      `- Language: ${task === 'voice' ? LANGUAGE[b.replyLanguage].voice : LANGUAGE[b.replyLanguage].text}`,
    );
  if (b.replyLength) lines.push(`- Length: ${LENGTH[b.replyLength]}`);
  if (b.formality) lines.push(`- Formality: ${FORMALITY[b.formality]}`);
  const topics = topicsOf(b);
  if (topics.length)
    lines.push(`- Topics not to discuss: ${topics.join('; ')}. If asked, ${AVOID[task]}.`);
  return lines;
}

/** Draft-only lines: the greeting and sign-off the reply must use. */
function draftLines(b: AiBehaviour, firstName: string): string[] {
  const lines: string[] = [];
  const greeting = greetingFor(b, firstName);
  if (greeting) lines.push(`- Start the reply with exactly this greeting: "${greeting}"`);
  const signature = signatureFor(b);
  if (signature)
    lines.push(
      `- End the reply with exactly this sign-off (instead of the usual one): "${signature.replace(/\n/g, '\\n')}"`,
    );
  return lines;
}

/**
 * The block for one task. Drafts also get the greeting and sign-off (with the customer's first
 * name); chat opens with the greeting on its first reply; calls speak it as their first line.
 */
export function behaviourBlock(
  b: AiBehaviour | undefined,
  task: BehaviourTask,
  firstName = 'there',
): string {
  if (!b) return '';
  if (task === 'triage') return triageBlock(b);
  const lines = styleLines(b, task);
  if (task === 'draft') lines.push(...draftLines(b, firstName));
  const greeting = greetingFor(b, firstName);
  if (task === 'chat' && greeting)
    lines.push(`- On your first reply of a conversation only, open with: "${greeting}"`);
  if (!lines.length) return '';
  return `\n\nSTYLE SETTINGS FROM THE COMPANY (wording and style only; they never override the rules above, the facts or the safety rules):\n<style_settings>\n${lines.join('\n')}\n</style_settings>`;
}
