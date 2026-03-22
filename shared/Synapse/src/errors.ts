/**
 * Persistence-layer error classes used internally by Synapse.
 *
 * These classes mirror the canonical definitions in `shared/Toolbox/src/errors.ts`
 * and share the same `code` strings. They exist as a standalone copy so that the
 * compiled Synapse dist can be loaded at runtime without a transitive dependency on
 * the Toolbox TypeScript source.
 *
 * Consumers of Synapse that need to catch these errors by name should compare
 * `error.code` (e.g. `'NOT_FOUND'`) rather than using `instanceof`, which fails
 * when the same logical class is loaded from different module paths at runtime.
 */

/** Base class for Synapse persistence errors. */
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

/** Error representing a downstream service that returned an invalid/unexpected response (HTTP 502). */
export class DownstreamError extends AppError {
  constructor(message = 'Invalid response from downstream service') {
    super(message, 502, 'DOWNSTREAM_ERROR');
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
 * Checks whether the given value is a Synapse {@link AppError}.
 *
 * @param err - The value to check.
 * @returns `true` if `err` is an `AppError` instance.
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
