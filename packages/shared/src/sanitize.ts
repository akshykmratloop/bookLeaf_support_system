import { z } from 'zod';

// Matching control characters is the purpose of this pattern (they are stripped from input).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAGS = /<\/?[a-zA-Z][^>]*>/g;

/**
 * Normalises free text at the boundary: trim, drop control characters, strip HTML tags,
 * NFC-normalise. Newlines and tabs are kept so multi-line descriptions survive.
 */
export function sanitizeText(input: string): string {
  return input.replace(CONTROL_CHARS, '').replace(HTML_TAGS, '').normalize('NFC').trim();
}

/** A sanitised free-text field with length limits applied after cleaning. */
export function cleanText(min: number, max: number) {
  return z
    .string()
    .max(max * 2, { message: `Must be at most ${max} characters` })
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(min, { message: `Must be at least ${min} characters` })
        .max(max, { message: `Must be at most ${max} characters` }),
    );
}
