/**
 * @module @elastic-resume-base/bowltie
 *
 * Bowltie provides shared API response formatting utilities for Elastic Resume Base
 * microservices, producing a consistent JSON envelope that is easy to consume
 * across the application.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
 *
 * res.status(200).json(formatSuccess(data, req.correlationId));
 * res.status(404).json(formatError('NOT_FOUND', 'User not found', req.correlationId));
 * ```
 */
export { formatSuccess, formatError } from './response.js';
export type { ResponseMeta, SuccessResponse, ErrorResponse, ApiResponse } from './response.js';
//# sourceMappingURL=index.d.ts.map