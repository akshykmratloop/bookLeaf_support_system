import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (text: string) => createHash('sha256').update(text).digest();

/** Compares two secrets in constant time, so neither length nor content leaks. */
export const sameSecret = (given: string, expected: string): boolean =>
  timingSafeEqual(digest(given), digest(expected));
