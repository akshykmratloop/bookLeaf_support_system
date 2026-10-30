const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** ₹3,570 / ₹1,00,000 (Indian grouping). Input is integer paise. */
export function formatInr(paise: number): string {
  return `₹${INR.format(paise / 100)}`;
}

/** "14 Feb 2026" from YYYY-MM-DD or an ISO timestamp. */
export function formatDate(iso: string): string {
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00.000Z`) : new Date(iso);
  return DATE.format(d);
}

/** "BL-1001": the workspace's fixed prefix and the ticket's number in that workspace (F-13). */
export function ticketNumberLabel(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}
