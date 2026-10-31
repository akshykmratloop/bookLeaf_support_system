/**
 * "The session has ended" as one app-wide signal. The API client raises it on a 401; the staff
 * layout and the widget shell (through useLiveUpdates) handle it the same way as the live stream's
 * own session-expired event: back to sign-in, or a fresh sign-in from the host page.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
/** Several requests failing together are one expiry, not one per request. */
const QUIET_MS = 5_000;
let lastSignal = Number.NEGATIVE_INFINITY;

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function signalSessionExpired(now: number = Date.now()): void {
  if (now - lastSignal < QUIET_MS) return;
  lastSignal = now;
  for (const listener of [...listeners]) listener();
}

/** For tests: forget the last signal. */
export function resetSessionExpiry(): void {
  lastSignal = Number.NEGATIVE_INFINITY;
  listeners.clear();
}
