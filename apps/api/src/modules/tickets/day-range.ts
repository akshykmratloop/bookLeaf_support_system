/**
 * Calendar days in the viewer's time zone (no date library): "from 1 Nov" in Asia/Kolkata starts
 * at 31 Oct 18:30 UTC. The zone's offset comes from Intl.DateTimeFormat for that very date, so
 * daylight-saving changes are honoured.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Milliseconds the zone's wall clock is ahead of UTC at `instant`. */
export function zoneOffsetMs(timeZone: string, instant: number): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** The instant a calendar day (YYYY-MM-DD, plus `addDays`) starts in `timeZone`. */
export function startOfDay(day: string, timeZone: string, addDays = 0): Date {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  const wallMidnight = Date.UTC(y, m - 1, d + addDays);
  // Two passes: the offset at the guess can differ from the offset at the answer near a DST change.
  const guess = wallMidnight - zoneOffsetMs(timeZone, wallMidnight);
  return new Date(wallMidnight - zoneOffsetMs(timeZone, guess));
}

/** created_at bounds for an inclusive from..to day range in `timeZone`. */
export function dayRange(
  from: string | undefined,
  to: string | undefined,
  timeZone: string,
): { gte?: Date; lt?: Date } {
  return {
    ...(from ? { gte: startOfDay(from, timeZone) } : {}),
    ...(to ? { lt: startOfDay(to, timeZone, 1) } : {}),
  };
}
