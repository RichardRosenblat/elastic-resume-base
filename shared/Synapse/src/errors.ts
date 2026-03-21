/**
 * Re-exports the canonical error classes from Toolbox so that all microservices
 * share a single class identity. Synapse is a persistence library — error class
 * ownership belongs to Toolbox.
 *
 * @see shared/Toolbox/src/errors.ts
 */
export {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  DownstreamError,
  UnavailableError,
  isAppError,
} from '../../Toolbox/src/errors.js';