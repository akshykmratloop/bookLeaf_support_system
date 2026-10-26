/**
 * Finds figures in free text and normalises them, so "Rs. 3570", "₹3,570.00" and
 * "3,570 rupees" all compare equal to 357000 paise.
 */
export interface Found<T> {
  raw: string;
  value: T;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const NUM = '(\\d{1,3}(?:,\\d{2,3})*(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';

const MONEY_PREFIX = new RegExp(`(?:₹|\\brs\\.?|\\binr)\\s*${NUM}`, 'gi');
const MONEY_SUFFIX = new RegExp(`\\b${NUM}\\s*(?:rupees|inr)\\b`, 'gi');
const DATE_DMY = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH},?\\s+(\\d{4})\\b`, 'gi');
const DATE_MDY = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi');
const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const DATE_SLASH = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
const DURATION = /\b(\d{1,3})(?:\s*(?:–|-|to)\s*(\d{1,3}))?\s*(business days|working days|days|hours|hrs|h)\b/gi;
const PERCENT = /\b(\d{1,3})\s*(?:%|percent\b)/gi;
const COPIES = /\b(\d{1,3}(?:,\d{3})*|\d+)\s+copies\b/gi;
export const PLACEHOLDER = /\[CONFIRM:[^\]]*\]/gi;

/** Text that looks numeric but is not a claim: ISBNs, ticket numbers. */
const EXCLUSIONS = [/\b97[89][-\d\sX]{10,20}\b/gi, /\bBL-\d+\b/g];

export function stripExclusions(text: string, extra: string[] = []): string {
  let out = text;
  for (const re of EXCLUSIONS) out = out.replace(re, ' ');
  for (const phrase of extra) if (phrase) out = out.split(phrase).join(' ');
  return out;
}

const toNumber = (s: string) => Number(s.replace(/,/g, ''));
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const monthIndex = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

export function findMoney(text: string): Found<number>[] {
  const out: Found<number>[] = [];
  for (const re of [MONEY_PREFIX, MONEY_SUFFIX]) {
    for (const m of text.matchAll(re)) out.push({ raw: m[0], value: Math.round(toNumber(m[1] ?? '0') * 100) });
  }
  return out;
}

export function findDates(text: string): Found<string>[] {
  const out: Found<string>[] = [];
  for (const m of text.matchAll(DATE_DMY)) out.push({ raw: m[0], value: iso(+m[3]!, monthIndex(m[2]!), +m[1]!) });
  for (const m of text.matchAll(DATE_MDY)) out.push({ raw: m[0], value: iso(+m[3]!, monthIndex(m[1]!), +m[2]!) });
  for (const m of text.matchAll(DATE_ISO)) out.push({ raw: m[0], value: iso(+m[1]!, +m[2]!, +m[3]!) });
  for (const m of text.matchAll(DATE_SLASH)) out.push({ raw: m[0], value: iso(+m[3]!, +m[2]!, +m[1]!) });
  return out;
}

/** Normalised as "48 hours", "24-48 hours", "5-7 business days". */
export function findDurations(text: string): Found<string>[] {
  return [...text.matchAll(DURATION)].map((m) => {
    const unit = (m[3] ?? '').toLowerCase();
    const normUnit = unit.startsWith('h') ? 'hours' : unit.includes('business') || unit.includes('working') ? 'business days' : 'days';
    const range = m[2] ? `${m[1]}-${m[2]}` : m[1]!;
    return { raw: m[0], value: `${range} ${normUnit}` };
  });
}

export function findPercents(text: string): Found<number>[] {
  return [...text.matchAll(PERCENT)].map((m) => ({ raw: m[0], value: Number(m[1]) }));
}

export function findCopyCounts(text: string): Found<number>[] {
  return [...text.matchAll(COPIES)].map((m) => ({ raw: m[0], value: toNumber(m[1]!) }));
}

export function findPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[0]);
}
