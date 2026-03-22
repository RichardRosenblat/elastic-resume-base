/**
 * Application error classes for internal Synapse use.
 * These are mirrors of the canonical definitions in shared/Toolbox/src/errors.ts.
 * Synapse is strictly a persistence library — external consumers should import
 * error classes from Toolbox directly.
 */
/** Base class for application errors with HTTP status code and machine-readable error code. */
export class AppError extends Error {
    statusCode;
    code;
    constructor(message, statusCode, code) {
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
/** Error representing a failure in a downstream service (HTTP 502). */
export class DownstreamError extends AppError {
    constructor(message = 'Invalid response from downstream service') {
        super(message, 502, 'DOWNSTREAM_ERROR');
    }
}
/**
 * Checks whether the given value is an {@link AppError}.
 *
 * @param err - The value to check.
 * @returns `true` if `err` is an `AppError` instance.
 */
export function isAppError(err) {
    return err instanceof AppError;
}
//# sourceMappingURL=errors.js.map