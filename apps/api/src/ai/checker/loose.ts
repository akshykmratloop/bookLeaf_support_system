/**
 * Figures written loosely: foreign currency, a day and month with no year, timelines in weeks or
 * months, and bare numbers that read as money. Each finder runs on text with the strict figures
 * (extract.ts) and the earlier loose ones blanked out, so one figure is reported once.
 */
import {
  findCopyCounts,
  findDates,
  findDurations,
  findMoney,
  findPercents,
  type Found,
} from './extract.js';
import { blankOut, MONTH, monthIndex, MULT, NUM, pad, parseAmount, toPaise } from './patterns.js';

const CURRENCY = '(\\$|€|£|\\b(?:usd|eur|gbp|aud|cad|sgd|aed)\\b)';
const CURRENCY_WORD = '(dollars?|euros?|pounds?|usd|eur|gbp|aud|cad|sgd|aed)';
const FOREIGN_PREFIX = new RegExp(`${CURRENCY}\\s*${NUM}(?:\\s*${MULT}\\b)?`, 'gi');
const FOREIGN_SUFFIX = new RegExp(`\\b${NUM}\\s*(?:${MULT}\\s*)?${CURRENCY_WORD}\\b`, 'gi');
const SHORT_DMY = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b`, 'gi');
const SHORT_MDY = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi');
const LONG_DURATION =
  /\b(\d{1,3})(?:\s*(?:–|-|to)\s*(\d{1,3}))?[\s-]*(weeks?|months?|quarters?)\b/gi;
const NUMBER = /\b\d+(?:,\d+)*(?:\.\d+)?\b/g;
const MONEY_WORD_BEFORE =
  /\b(?:royalt(?:y|ies)|payouts?|amount|pending|paid|earned|balance)(?:[ \t]+[a-z']+){0,3}[ \t]+$/i;
const COUNTED_NOUN =
  /^[ \t]+(?!(?:is|was|are|were|has|have|had|will|would|and|or|but|only|so|to|now|today|in|on|at|for|by|this|which|that|from|as|into|per|each|with)\b)[a-z]/i;
const YEAR_AFTER = /\b(?:in|for|since|during|from|until|till|by|year)[ \t]+$/i;

const CODE: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP' };
const currencyCode = (s: string) => {
  const w = s.toLowerCase().replace(/s$/, '');
  if (CODE[s]) return CODE[s];
  return (
    ({ dollar: 'USD', euro: 'EUR', pound: 'GBP' } as Record<string, string>)[w] ?? w.toUpperCase()
  );
};
const DAYS_PER: Record<string, number> = { week: 7, month: 30, quarter: 90 };

function findForeignMoney(text: string): Found<string>[] {
  const prefix = [...text.matchAll(FOREIGN_PREFIX)].map((m) => ({
    raw: m[0],
    value: `${currencyCode(m[1]!)}:${toPaise(m[2]!, m[3])}`,
  }));
  const suffix = [...blankOut(text, FOREIGN_PREFIX).matchAll(FOREIGN_SUFFIX)].map((m) => ({
    raw: m[0],
    value: `${currencyCode(m[3]!)}:${toPaise(m[1]!, m[2])}`,
  }));
  return [...prefix, ...suffix];
}

const monthDay = (month: string, day: string) =>
  +day >= 1 && +day <= 31 ? `--${pad(monthIndex(month))}-${pad(+day)}` : `invalid:${day}`;

/** "20 Feb", "20th of February", "February 20": compared with the facts by month and day. */
function findShortDates(text: string): Found<string>[] {
  const dmy = [...text.matchAll(SHORT_DMY)].map((m) => ({
    raw: m[0],
    value: monthDay(m[2]!, m[1]!),
  }));
  const mdy = [...blankOut(text, SHORT_DMY).matchAll(SHORT_MDY)].map((m) => ({
    raw: m[0],
    value: monthDay(m[1]!, m[2]!),
  }));
  return [...dmy, ...mdy];
}

/** "2 weeks", "3-4 months", "1 quarter" as calendar days, compared with the day timelines. */
function findLongDurations(text: string): Found<string>[] {
  return [...text.matchAll(LONG_DURATION)].map((m) => {
    const per = DAYS_PER[(m[3] ?? '').toLowerCase().replace(/s$/, '')] ?? 1;
    const range = m[2] ? `${+m[1]! * per}-${+m[2] * per}` : `${+m[1]! * per}`;
    return { raw: m[0], value: `${range} days` };
  });
}

/** Whether a bare number reads as a money figure ("royalty of 9999", "9,999"). */
function readsAsMoney(text: string, at: number, raw: string): boolean {
  const before = text.slice(Math.max(0, at - 60), at);
  const after = text.slice(at + raw.length);
  if (raw.includes(',')) return parseAmount(raw) >= 1000 || raw.replace(/\D/g, '').length >= 4;
  if (!MONEY_WORD_BEFORE.test(before) || COUNTED_NOUN.test(after)) return false;
  return !(/^(?:19|20)\d{2}$/.test(raw) && YEAR_AFTER.test(before));
}

/** Bare numbers that read as money, in paise; allowed when they match a money fact or a count. */
function findBareFigures(text: string): Found<number>[] {
  return [...text.matchAll(NUMBER)]
    .filter((m) => readsAsMoney(text, m.index ?? 0, m[0]))
    .map((m) => ({ raw: m[0], value: toPaise(m[0]) }));
}

export interface LooseFigures {
  foreign: Found<string>[];
  shortDates: Found<string>[];
  longDurations: Found<string>[];
  bare: Found<number>[];
}

const blankRaw = (text: string, found: Found<unknown>[]) =>
  found.reduce((t, f) => t.split(f.raw).join(' '.repeat(f.raw.length)), text);

export function findLoose(text: string): LooseFigures {
  let rest = blankRaw(text, [
    ...findMoney(text),
    ...findDates(text),
    ...findDurations(text),
    ...findPercents(text),
    ...findCopyCounts(text),
  ]);
  const foreign = findForeignMoney(rest);
  rest = blankRaw(rest, foreign);
  const shortDates = findShortDates(rest);
  rest = blankRaw(rest, shortDates);
  const longDurations = findLongDurations(rest);
  rest = blankRaw(rest, longDurations);
  return { foreign, shortDates, longDurations, bare: findBareFigures(rest) };
}

export { findForeignMoney };
