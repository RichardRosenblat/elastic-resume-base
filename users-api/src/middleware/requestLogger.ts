import { createRequestLoggerHook } from '../../../shared/Toolbox/src/middleware/requestLogger.js';
import { logger } from '../utils/logger.js';

/**
 * Fastify onResponse hook that logs each HTTP request after the response is sent.
 * Delegates to the shared `createRequestLoggerHook` factory from Toolbox.
 */
export const requestLoggerHook = createRequestLoggerHook(logger);
