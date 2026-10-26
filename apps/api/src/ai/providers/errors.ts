/** Capability-level AI errors. Vendor errors are mapped to these inside each adapter. */
export abstract class AiError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class AiUnavailableError extends AiError {
  readonly code = 'AI_UNAVAILABLE';
  readonly retryable = true;
}

export class AiRateLimitedError extends AiError {
  readonly code = 'AI_RATE_LIMITED';
  readonly retryable = true;
  constructor(
    message: string,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
  }
}

export class AiInvalidOutputError extends AiError {
  readonly code = 'AI_INVALID_OUTPUT';
  readonly retryable = true;
}

export class AiAuthError extends AiError {
  readonly code = 'AI_AUTH';
  readonly retryable = false;
}

export class AiBadRequestError extends AiError {
  readonly code = 'AI_BAD_REQUEST';
  readonly retryable = false;
}

export class AiNotConfiguredError extends AiError {
  readonly code = 'AI_NOT_CONFIGURED';
  readonly retryable = false;
}

export class AiOutageSimulatedError extends AiError {
  readonly code = 'AI_OUTAGE_SIMULATED';
  readonly retryable = false;
}
