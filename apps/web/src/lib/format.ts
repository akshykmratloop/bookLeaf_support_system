import { formatDate, formatInr } from '@bookleaf/shared';

/** Unknown is shown as unknown, never as zero. */
export const money = (paise: number | null, unknown = 'Not set') => (paise === null ? unknown : formatInr(paise));
export const day = (iso: string | null, unknown = 'Not set') => (iso === null ? unknown : formatDate(iso.slice(0, 10)));

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relative(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const unit = abs < HOUR ? `${Math.max(1, Math.round(abs / MINUTE))} min` : abs < DAY ? `${Math.round(abs / HOUR)} h` : `${Math.round(abs / DAY)} d`;
  return diff >= 0 ? `${unit} ago` : `in ${unit}`;
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export interface SlaView {
  text: string;
  overdue: boolean;
}

/** First-response SLA: met once the team has replied; otherwise time left or overdue. */
export function sla(slaDueAt: string, firstResponseAt: string | null, now = Date.now()): SlaView {
  if (firstResponseAt) return { text: 'Responded', overdue: false };
  const due = new Date(slaDueAt).getTime();
  return due < now ? { text: `Overdue ${relative(slaDueAt, now).replace(' ago', '')}`, overdue: true } : { text: `Due ${relative(slaDueAt, now)}`, overdue: false };
}
