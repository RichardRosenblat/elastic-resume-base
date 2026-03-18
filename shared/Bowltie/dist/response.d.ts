/** Metadata included in every API response. */
export interface ResponseMeta {
    /** Correlation / request ID for distributed tracing. */
    readonly correlationId?: string;
    /** ISO-8601 timestamp of when the response was generated. */
    readonly timestamp: string;
}
/** Standard success response envelope. */
export interface SuccessResponse<T = unknown> {
    readonly success: true;
    readonly data: T;
    readonly meta: ResponseMeta;
}
/** Standard error response envelope. */
export interface ErrorResponse {
    readonly success: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
    };
    readonly meta: ResponseMeta;
}
/** Union of success and error response envelopes. */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
/**
 * Builds a standard success response envelope.
 *
 * @param data - The payload to include in the response.
 * @param correlationId - Optional correlation/request ID for tracing.
 * @returns A {@link SuccessResponse} object ready to be serialised and returned to the client.
 *
 * @example
 * ```typescript
 * res.status(200).json(formatSuccess({ uid: 'abc123', email: 'user@example.com' }, req.correlationId));
 * ```
 */
export declare function formatSuccess<T>(data: T, correlationId?: string): SuccessResponse<T>;
/**
 * Builds a standard error response envelope.
 *
 * @param code - Machine-readable error code (e.g. `'NOT_FOUND'`, `'VALIDATION_ERROR'`).
 * @param message - Human-readable error description.
 * @param correlationId - Optional correlation/request ID for tracing.
 * @returns An {@link ErrorResponse} object ready to be serialised and returned to the client.
 *
 * @example
 * ```typescript
 * res.status(404).json(formatError('NOT_FOUND', 'User not found', req.correlationId));
 * ```
 */
export declare function formatError(code: string, message: string, correlationId?: string): ErrorResponse;
//# sourceMappingURL=response.d.ts.map