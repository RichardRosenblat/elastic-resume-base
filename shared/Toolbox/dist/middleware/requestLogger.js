/**
 * Factory that creates a Fastify `onResponse` hook for structured HTTP request logging.
 *
 * The returned hook logs a single `info`-level entry per request after the response
 * has been sent.  Each entry includes:
 * - `method` — HTTP verb (GET, POST, …)
 * - `path` — request URL (path + query string)
 * - `statusCode` — HTTP response status code
 * - `durationMs` — elapsed time in milliseconds (rounded)
 * - `correlationId` — trace ID forwarded from {@link correlationIdHook}
 *
 * Using a factory rather than a module-level import allows each service to inject
 * its own Pino logger instance, keeping the middleware free of service-specific
 * dependencies.
 *
 * @example
 * ```typescript
 * import { createRequestLoggerHook } from '@elastic-resume-base/toolbox';
 * import { logger } from '../utils/logger.js';
 *
 * app.addHook('onResponse', createRequestLoggerHook(logger));
 * ```
 *
 * @param logger - A Pino {@link Logger} instance (or compatible interface) used to emit the log entry.
 * @returns A hook function compatible with Fastify's `onResponse` hook signature.
 */
export function createRequestLoggerHook(logger) {
    return function requestLoggerHook(request, reply, done) {
        logger.info({
            method: request.method,
            path: request.url,
            statusCode: reply.statusCode,
            durationMs: Math.round(reply.elapsedTime),
            correlationId: request.correlationId,
        }, 'HTTP request');
        done();
    };
}
//# sourceMappingURL=requestLogger.js.map