import { formatDate, type CustomerFieldType, type Fact } from '@bookleaf/shared';

type Converted =
  { ok: true; value: number | string; display: string } | { ok: false; reason: string };

const MAX_TEXT = 300;
const DECIMAL = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** The fact type the assistant sees for a customer-data field type. */
export const factTypeOf = (type: CustomerFieldType): Fact['type'] =>
  type === 'NUMBER' ? 'COUNT' : type;

const asNumber = (raw: unknown): number | null => {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** BELOW_THRESHOLD → "Below threshold". */
const humanize = (code: string) => {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function toText(raw: unknown): Converted {
  if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean')
    return { ok: false, reason: 'not a text value' };
  const text = String(raw).trim().slice(0, MAX_TEXT);
  return text ? { ok: true, value: text, display: text } : { ok: false, reason: 'empty value' };
}

function toStatus(raw: unknown, allowed: string[]): Converted {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, reason: 'not a status code' };
  const code = raw
    .trim()
    .toUpperCase()
    .replaceAll(/[\s-]+/g, '_');
  if (allowed.length > 0 && !allowed.includes(code))
    return { ok: false, reason: `unexpected status ${code.slice(0, 40)}` };
  return { ok: true, value: code, display: humanize(code) };
}

function toDate(raw: unknown): Converted {
  if (typeof raw !== 'string' || !ISO_DATE.test(raw.trim()) || Number.isNaN(Date.parse(raw)))
    return { ok: false, reason: 'not a date (YYYY-MM-DD)' };
  const day = raw.trim().slice(0, 10);
  return { ok: true, value: day, display: formatDate(day) };
}

/**
 * Turns a value read from a product's JSON into a fact value of the field's type, or says why
 * it cannot. MONEY is in minor units (paise, cents), as in the fixed customer shape.
 */
export function toFactValue(type: CustomerFieldType, raw: unknown, allowed: string[]): Converted {
  if (raw === undefined || raw === null) return { ok: false, reason: 'no value at this path' };
  if (type === 'TEXT') return toText(raw);
  if (type === 'STATUS') return toStatus(raw, allowed);
  if (type === 'DATE') return toDate(raw);
  const n = asNumber(raw);
  if (n === null) return { ok: false, reason: 'not a number' };
  if (type === 'MONEY') return { ok: true, value: Math.round(n), display: DECIMAL.format(n / 100) };
  return { ok: true, value: n, display: String(n) };
}
