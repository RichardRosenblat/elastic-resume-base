import type { FastifyRequest } from 'fastify';
import type { errorResponseBuilderContext } from '@fastify/rate-limit';
import { RateLimitError } from '../errors.js';
import { logger } from './logger.js';

/**
 * Builds a Fastify rate-limit `errorResponseBuilder` that throws a
 * {@link RateLimitError} (an `AppError` subclass with `statusCode=429`) and
 * emits a WARN log. The existing `errorHandler` middleware then formats the
 * error into a Bowltie `RATE_LIMIT_EXCEEDED` envelope automatically.
 *
 * @param scopeLabel - Short label included in the log message to distinguish
 *   the global limiter from per-route limiters (e.g. `'Global'`, `'API v1'`).
 * @returns The `errorResponseBuilder` function accepted by `@fastify/rate-limit`.
 */
export function buildRateLimitErrorResponseBuilder(
  scopeLabel: string,
): (req: FastifyRequest, context: errorResponseBuilderContext) => RateLimitError {
  return (req, context) => {
    const retryAfterSec = Math.max(1, Math.ceil(context.ttl / 1000));
    const message = `Too many requests. Please wait ${retryAfterSec} second${retryAfterSec !== 1 ? 's' : ''} and try again.`;
    const correlationId = req.correlationId ?? req.id;
    logger.warn({ correlationId, ip: req.ip, limit: context.max }, `${scopeLabel} rate limit exceeded`);
    return new RateLimitError(message);
  };
}
