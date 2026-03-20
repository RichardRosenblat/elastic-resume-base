/**
 * Application error classes for the Users API.
 * Canonical definitions live in shared/Toolbox/src/errors.ts and are
 * re-exported here so all internal modules can use a short local import path.
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
} from '@shared/toolbox';
