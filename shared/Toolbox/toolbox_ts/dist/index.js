/**
 * @elastic-resume-base/toolbox
 *
 * Shared cross-cutting utilities for Elastic Resume Base microservices.
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
