import type { IncomingHttpHeaders } from 'node:http';

type Headers = Pick<IncomingHttpHeaders, 'referer' | 'sec-fetch-dest'>;

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    // A Referer that is not a URL names no site: nothing to record.
    return null;
  }
}

/**
 * Which of the workspace's allowed sites framed this widget page request, or null. The browser
 * names the framing page in `Referer` (at least its origin, under the default referrer policy)
 * and marks the request `Sec-Fetch-Dest: iframe`. A top-level visit or any other site is null.
 * Only used to tick the setup guide's "Add the widget" step (U-12); it grants nothing.
 */
export function framedFrom(headers: Headers, allowed: readonly string[]): string | null {
  const dest = headers['sec-fetch-dest'];
  if (dest !== undefined && dest !== 'iframe') return null;
  const referer = headers.referer;
  if (!referer) return null;
  const origin = originOf(referer);
  return origin && allowed.includes(origin) ? origin : null;
}
