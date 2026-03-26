/**
 * Factory that creates a Fastify `onResponse` hook for structured HTTP request logging.
 *
 * The returned hook logs a single `info`-level entry per request after the response
 * has been sent.
 *
 * @param logger - A Pino logger instance (or any object with an `info` method).
 * @returns A hook function compatible with Fastify's `onResponse` hook signature.
 */
export function createRequestLoggerHook(logger) {
  return function requestLoggerHook(request, reply, done) {
    logger.info(
      {
        method: request.method,
        path: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        correlationId: request.correlationId,
      },
      'HTTP request',
    );
    done();
  };
}
