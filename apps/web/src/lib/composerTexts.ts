/** The two boxes of the staff composer. */
export type ComposerMode = 'REPLY' | 'INTERNAL_NOTE';

/**
 * The reply to the author and the internal note each keep their own text (U-3): switching the
 * message type never copies, moves or drops what was typed in the other box.
 */
export interface ComposerTexts {
  reply: string;
  note: string;
}

export const EMPTY_TEXTS: ComposerTexts = { reply: '', note: '' };

const field = (mode: ComposerMode): keyof ComposerTexts => (mode === 'REPLY' ? 'reply' : 'note');

export const textFor = (texts: ComposerTexts, mode: ComposerMode): string => texts[field(mode)];

export const withText = (
  texts: ComposerTexts,
  mode: ComposerMode,
  value: string,
): ComposerTexts => ({ ...texts, [field(mode)]: value });

/** After a send: only the box that was sent is emptied. */
export const cleared = (texts: ComposerTexts, mode: ComposerMode): ComposerTexts =>
  withText(texts, mode, '');
