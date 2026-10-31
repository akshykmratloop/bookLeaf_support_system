import { AI_CALL_TIMEOUT_MS } from '../providers/limits.js';

/** How long a claimed job stays this worker's before another may reclaim it. */
export const DEFAULT_LEASE_MS = 90_000;
/** Headroom for the database writes around the calls. */
export const LEASE_MARGIN_MS = 10_000;

export class LeaseTooShortError extends Error {
  constructor(leaseMs: number, neededMs: number) {
    super(
      `AI job lease (${leaseMs} ms) must exceed the AI and host timeouts plus margin (${neededMs} ms)`,
    );
    this.name = 'LeaseTooShortError';
  }
}

/**
 * A lease shorter than one job's slowest path lets a second worker reclaim a job that is still
 * running, so both write. Checked when the worker is built: a bad setting stops startup.
 */
export function assertLeaseCoversCalls(leaseMs: number, hostTimeoutMs: number): void {
  const neededMs = AI_CALL_TIMEOUT_MS + hostTimeoutMs + LEASE_MARGIN_MS;
  if (leaseMs <= neededMs) throw new LeaseTooShortError(leaseMs, neededMs);
}
