export interface ThreadLine {
  /** The call this line was spoken on, or null for a typed line. */
  callId: string | null;
  at: string;
}

export type ThreadItem<T> =
  { kind: 'message'; message: T } | { kind: 'call'; callId: string; minutes: number; at: string };

const MINUTE_MS = 60_000;

/** Whole minutes from a call's first to its last saved line, at least one. */
function callMinutes(times: readonly string[]): number {
  const first = Date.parse(times[0] ?? '');
  const last = Date.parse(times.at(-1) ?? '');
  const ms = Number.isFinite(first) && Number.isFinite(last) ? last - first : 0;
  return Math.max(1, Math.round(ms / MINUTE_MS));
}

/**
 * The conversation as it is shown: typed and spoken lines in order, with a "Call · N min"
 * divider before the lines of each call that was part of it.
 */
export function threadItems<T>(
  items: readonly T[],
  lineOf: (item: T) => ThreadLine,
): ThreadItem<T>[] {
  const times = new Map<string, string[]>();
  for (const item of items) {
    const { callId, at } = lineOf(item);
    if (callId) times.set(callId, [...(times.get(callId) ?? []), at]);
  }
  const out: ThreadItem<T>[] = [];
  let previousCall: string | null = null;
  for (const item of items) {
    const { callId, at } = lineOf(item);
    if (callId && callId !== previousCall)
      out.push({ kind: 'call', callId, minutes: callMinutes(times.get(callId) ?? []), at });
    previousCall = callId;
    out.push({ kind: 'message', message: item });
  }
  return out;
}

/** How a chat message sits in the thread. */
export const chatLine = (m: { callId: string | null; createdAt: string }): ThreadLine => ({
  callId: m.callId,
  at: m.createdAt,
});
