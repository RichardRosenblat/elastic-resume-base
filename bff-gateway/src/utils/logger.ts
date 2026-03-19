import { createLogger } from '../../../shared/Toolbox/src/createLogger.js';
import { config } from '../config.js';

/**
 * Service-level Pino logger for bff-gateway.
 * In development the output is pretty-printed; in production it emits
 * Google Cloud Logging-compatible structured JSON.
 */
export const logger = createLogger({
  serviceName: 'bff-gateway',
  logLevel: config.logLevel,
  nodeEnv: config.nodeEnv,
});