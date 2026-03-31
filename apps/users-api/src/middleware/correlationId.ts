import { createCorrelationIdHook } from '@shared/toolbox';
import { logger } from '../utils/logger.js';

/**
 * Fastify `onRequest` hook that attaches or generates a correlation ID and
 * GCP Cloud Trace context on every request, and logs a warning when either
 * tracing header is absent in the incoming request.
 */
export const correlationIdHook = createCorrelationIdHook(logger);
