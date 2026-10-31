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

/** A super admin switched AI off for this customer (U-7): rules and templates run instead. */
export class AiDisabledForWorkspaceError extends AiError {
  readonly code = 'AI_DISABLED_FOR_CUSTOMER';
  readonly retryable = false;
}

/** The workspace has no active category to triage into: the rules fallback runs instead. */
export class NoCategoriesError extends AiError {
  readonly code = 'NO_CATEGORIES';
  readonly retryable = false;
  constructor() {
    super('The workspace has no active ticket category');
  }
}

/** The workspace used up its daily AI runs for tickets: rules and templates run instead. */
export class AiBudgetExceededError extends AiError {
  readonly code = 'AI_BUDGET';
  readonly retryable = false;
}
