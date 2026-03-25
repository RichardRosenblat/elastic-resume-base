/** Base class for application errors with HTTP status code and machine-readable error code. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Error representing a resource that could not be found (HTTP 404). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** Error representing a missing or invalid authentication credential (HTTP 401). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** Error representing invalid input data (HTTP 400). */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/** Error representing a conflict with existing data (HTTP 409). */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/** Error representing an action that is not permitted for the authenticated user (HTTP 403). */
export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Error representing a downstream service that returned a response in an invalid or
 * unexpected format (HTTP 502). Use this only when the downstream did respond but the
 * response could not be parsed or did not match the expected schema.
 *
 * For connectivity/availability issues use {@link UnavailableError} instead.
 */
export class DownstreamError extends AppError {
  constructor(
    message = 'Invalid response from downstream service',
    statusCode = 502,
    code = 'DOWNSTREAM_ERROR',
  ) {
    super(message, statusCode, code);
  }
}

/**
 * Error representing a downstream service that is currently unavailable (HTTP 503).
 * Use for network failures, timeouts, or upstream 5xx responses.
 */
export class UnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Error representing a rate limit imposed by a downstream service or by this
 * gateway itself (HTTP 429). Thrown when a downstream API returns 429 so the
 * BFF can propagate the rate-limit signal to the caller with an appropriate
 * status code and error code.
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please wait a moment and try again.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Checks whether the given value is an {@link AppError}.
 *
 * @param err - The value to check.
 * @returns `true` if `err` is an `AppError` instance.
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
