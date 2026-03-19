import { createLogger } from '../../../shared/Toolbox/src/createLogger.js';
import { config } from '../config.js';

/**
 * Service-level Pino logger for users-api.
 * In development the output is pretty-printed; in production it emits
 * Google Cloud Logging-compatible structured JSON.
 */
export const logger = createLogger({
  serviceName: 'users-api',
  logLevel: config.logLevel,
  nodeEnv: config.nodeEnv,
});
