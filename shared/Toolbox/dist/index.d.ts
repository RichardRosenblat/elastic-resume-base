/**
 * @elastic-resume-base/toolbox
 *
 * Shared cross-cutting utilities for Elastic Resume Base microservices.
 *
 * ## Exports
 *
 * - **`loadConfigYaml`** — Loads `config.yaml` and populates `process.env`
 *   with the merged `systems.shared` + `systems.<service>` section.
 *
 * - **`createLogger`** — Factory that creates a Pino logger pre-configured
 *   with service metadata and environment-appropriate transport
 *   (pretty-print for dev/test, GCP-formatted JSON for production).
 *
 * - **`correlationIdHook`** — Fastify `onRequest` hook that attaches or
 *   generates a `x-correlation-id` for distributed tracing.
 *
 * - **`createRequestLoggerHook`** — Factory returning a Fastify `onResponse`
 *   hook that logs structured HTTP request/response details.
 *
 * @module @elastic-resume-base/toolbox
 */
export { loadConfigYaml } from './loadConfigYaml.js';
export { createLogger } from './createLogger.js';
export type { CreateLoggerOptions } from './createLogger.js';
export { correlationIdHook } from './middleware/correlationId.js';
export { createRequestLoggerHook } from './middleware/requestLogger.js';
//# sourceMappingURL=index.d.ts.map