/**
 * @elastic-resume-base/toolbox
 *
 * Shared cross-cutting utilities for Elastic Resume Base microservices.
 *
 * ## Exports
 *
 * - **`correlationIdHook`** — Fastify `onRequest` hook that attaches or
 *   generates a `x-correlation-id` for distributed tracing.
 *
 * - **`createRequestLoggerHook`** — Factory returning a Fastify `onResponse`
 *   hook that logs structured HTTP request/response details.
 *
 * - **Error classes** — `AppError`, `NotFoundError`, `UnauthorizedError`,
 *   `ValidationError`, `ConflictError`, `ForbiddenError`, `DownstreamError`,
 *   `UnavailableError`, `isAppError` — canonical HTTP-mapped application errors
 *   shared across all microservices.
 *
 * @module @elastic-resume-base/toolbox
 */

export { correlationIdHook } from './middleware/correlationId.js';
export { createRequestLoggerHook } from './middleware/requestLogger.js';
export {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  DownstreamError,
  UnavailableError,
  RateLimitError,
  isAppError,
} from './errors.js';
