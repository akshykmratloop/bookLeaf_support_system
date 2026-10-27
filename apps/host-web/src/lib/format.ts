import { formatDate, formatInr } from '@bookleaf/shared';

/** ₹ from paise; null means "not set yet" (a book still in production). */
export const rupees = (paise: number | null, unknown = 'Not set yet') =>
  paise === null ? unknown : formatInr(paise);

export const day = (iso: string | null, unknown = 'Not yet') =>
  iso === null ? unknown : formatDate(iso);

const COMPACT = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
export const compact = (n: number) => COMPACT.format(n);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
