/**
 * @elastic-resume-base/toolbox
 *
 * Shared cross-cutting utilities for Elastic Resume Base microservices.
 * All exports rely only on Node.js built-ins — no npm packages required.
 *
 * ## Exports
 *
 * - **`correlationIdHook`** — Fastify `onRequest` hook that attaches or
 *   generates a `x-correlation-id` for distributed tracing.
 *
 * - **`createRequestLoggerHook`** — Factory returning a Fastify `onResponse`
 *   hook that logs structured HTTP request/response details.
 *
 * @module @elastic-resume-base/toolbox
 */

export { correlationIdHook } from './middleware/correlationId.js';
export { createRequestLoggerHook } from './middleware/requestLogger.js';
