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
export function formatSuccess(data, correlationId) {
    return {
        success: true,
        data,
        meta: {
            correlationId,
            timestamp: new Date().toISOString(),
        },
    };
}
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
export function formatError(code, message, correlationId) {
    return {
        success: false,
        error: { code, message },
        meta: {
            correlationId,
            timestamp: new Date().toISOString(),
        },
    };
}
//# sourceMappingURL=response.js.map