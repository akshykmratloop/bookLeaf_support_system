/** The longest a shutdown may take before the process is stopped anyway. */
export const SHUTDOWN_LIMIT_MS = 25_000;

export interface ShutdownLog {
  info(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
  fatal(details: Record<string, unknown>, message: string): void;
}

export interface ShutdownDeps {
  log: ShutdownLog;
  /** Closes the app, shared state and database, in that order. */
  close: () => Promise<void>;
  exit: (code: number) => void;
  limitMs?: number;
}

/**
 * Stops the server once, whatever asked first (a signal or a crash). If closing hangs (a stuck
 * connection, an unreachable Redis), the process exits after the limit instead of waiting forever.
 */
export function createShutdown(
  deps: ShutdownDeps,
): (reason: string, code: number) => Promise<void> {
  let stopping = false;
  return async (reason, code) => {
    if (stopping) return;
    stopping = true;
    deps.log.info({ reason }, 'shutting down');
    const force = setTimeout(() => {
      deps.log.error({ reason, limitMs: deps.limitMs ?? SHUTDOWN_LIMIT_MS }, 'shutdown timed out');
      deps.exit(1);
    }, deps.limitMs ?? SHUTDOWN_LIMIT_MS);
    force.unref();
    try {
      await deps.close();
      clearTimeout(force);
      deps.exit(code);
    } catch (err) {
      clearTimeout(force);
      deps.log.error({ err, reason }, 'shutdown failed');
      deps.exit(1);
    }
  };
}

/** The process events the guards listen to (`process` itself, or an emitter in tests). */
export interface ProcessEvents {
  on(
    event: 'unhandledRejection' | 'uncaughtException' | NodeJS.Signals,
    listener: (arg: unknown) => void,
  ): unknown;
}

/**
 * A promise nobody awaited that failed is logged and the server keeps serving: one bad request
 * must not stop it for everyone. An exception nobody caught leaves the process in an unknown
 * state, so it is logged and the server shuts down (the orchestrator starts a fresh one).
 */
export function guardProcess(
  proc: ProcessEvents,
  log: ShutdownLog,
  shutdown: (reason: string, code: number) => Promise<void>,
): void {
  proc.on('unhandledRejection', (reason: unknown) => {
    log.error({ err: reason }, 'unhandled promise rejection');
  });
  proc.on('uncaughtException', (err: unknown) => {
    log.fatal({ err }, 'uncaught exception');
    void shutdown('uncaughtException', 1);
  });
  proc.on('SIGTERM', () => void shutdown('SIGTERM', 0));
  proc.on('SIGINT', () => void shutdown('SIGINT', 0));
}
