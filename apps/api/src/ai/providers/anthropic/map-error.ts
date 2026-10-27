import Anthropic from '@anthropic-ai/sdk';
import {
  AiAuthError,
  AiBadRequestError,
  AiError,
  AiRateLimitedError,
  AiUnavailableError,
} from '../errors.js';

function retryAfterMs(headers: Headers | undefined): number | null {
  const raw = headers?.get('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
}

/** Translates SDK errors into capability errors. Vendor messages never leave this module. */
export function mapAnthropicError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.RateLimitError) {
    return new AiRateLimitedError('Provider rate limit reached', retryAfterMs(error.headers));
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new AiAuthError('Provider rejected the API key');
  }
  if (error instanceof Anthropic.NotFoundError || error instanceof Anthropic.BadRequestError) {
    return new AiBadRequestError(`Provider rejected the request (${error.status})`);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiUnavailableError('Provider unreachable or timed out');
  }
  if (error instanceof Anthropic.APIError) {
    return new AiUnavailableError(`Provider error (${error.status ?? 'unknown'})`);
  }
  return new AiUnavailableError('Unexpected provider failure');
}
