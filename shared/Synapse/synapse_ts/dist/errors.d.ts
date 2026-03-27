/**
 * Application error classes for internal Synapse use.
 * These are mirrors of the canonical definitions in shared/Toolbox/src/errors.ts.
 * Synapse is strictly a persistence library — external consumers should import
 * error classes from Toolbox directly.
 */
/** Base class for application errors with HTTP status code and machine-readable error code. */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    constructor(message: string, statusCode: number, code: string);
}
/** Error representing a resource that could not be found (HTTP 404). */
export declare class NotFoundError extends AppError {
    constructor(message?: string);
}
/** Error representing a missing or invalid authentication credential (HTTP 401). */
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
/** Error representing invalid input data (HTTP 400). */
export declare class ValidationError extends AppError {
    constructor(message?: string);
}
/** Error representing a conflict with existing data (HTTP 409). */
export declare class ConflictError extends AppError {
    constructor(message?: string);
}
/** Error representing an action that is not permitted for the authenticated user (HTTP 403). */
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
/** Error representing a failure in a downstream service (HTTP 502). */
export declare class DownstreamError extends AppError {
    constructor(message?: string);
}
/**
 * Checks whether the given value is an {@link AppError}.
 *
 * @param err - The value to check.
 * @returns `true` if `err` is an `AppError` instance.
 */
export declare function isAppError(err: unknown): err is AppError;
//# sourceMappingURL=errors.d.ts.map