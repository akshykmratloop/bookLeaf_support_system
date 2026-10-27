/** Typed application errors. One handler maps them to RFC 7807 responses. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Sign in to continue') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: { path: string; message: string }[]) {
    super(422, 'VALIDATION_FAILED', message, fieldErrors);
  }
}

/** Reply text failed the factual checker; carries the issues so the UI can show them. */
export class CheckFailedError extends AppError {
  constructor(
    message: string,
    readonly details: unknown,
  ) {
    super(422, 'CHECK_FAILED', message);
  }
}

/** An admin has switched this author feature off. */
export class FeatureDisabledError extends AppError {
  constructor(feature: string) {
    super(403, 'FEATURE_DISABLED', `${feature} is switched off by the BookLeaf team.`);
  }
}

/** A per-author usage limit (daily messages, call quota) was reached. */
export class UsageLimitError extends AppError {
  constructor(code: string, message: string) {
    super(429, code, message);
  }
}
