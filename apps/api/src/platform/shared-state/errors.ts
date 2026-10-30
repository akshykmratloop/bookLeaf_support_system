/** Too many requests are already waiting (or running) for the same key. */
export class QueueFullError extends Error {
  constructor(readonly key: string) {
    super('Too many requests waiting for the same key');
    this.name = 'QueueFullError';
  }
}

/** The shared-state backend (Redis) cannot be reached or answered with something unexpected. */
export class SharedStateUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SharedStateUnavailableError';
  }
}
