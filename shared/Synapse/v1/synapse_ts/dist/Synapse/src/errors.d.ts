/**
 * Re-exports the canonical error classes from Toolbox so that all microservices
 * share a single error hierarchy. Error class ownership belongs to Toolbox.
 *
 * At build time esbuild resolves this relative path and inlines the Toolbox
 * source into `dist/index.js`, so the classes are available at runtime without
 * any separate Toolbox compilation step.
 *
 * @see shared/Toolbox/src/errors.ts
 */
export { AppError, NotFoundError, UnauthorizedError, ValidationError, ConflictError, ForbiddenError, DownstreamError, UnavailableError, isAppError, } from '../../Toolbox/src/errors.js';
//# sourceMappingURL=errors.d.ts.map