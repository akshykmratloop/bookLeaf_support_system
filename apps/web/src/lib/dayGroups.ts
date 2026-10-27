const LONG_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function labelFor(d: Date, now: Date): string {
  if (dayKey(d) === dayKey(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return LONG_DAY.format(d);
}

export interface DayGroup<T> {
  label: string;
  items: T[];
}

/** Items already sorted newest first, grouped by local day (for timelines). */
export function groupByDay<T>(items: readonly T[], at: (item: T) => string, now = new Date()) {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const label = labelFor(new Date(at(item)), now);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
