import { type LoggerOptions, pino, type Logger } from 'pino';
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';
import { config } from '../config.js';

/**
 * Creates and returns a configured Pino {@link Logger} instance.
 *
 * - **Development / test** — pretty-printed, colourised output via `pino-pretty`.
 * - **Production** — structured JSON formatted for Google Cloud Logging,
 *   with `service.name` and `service.version` embedded in every entry.
 */
export function createLogger(options: {
  serviceName: string;
  version?: string;
  logLevel?: string;
  nodeEnv?: string;
}): Logger {
  const { serviceName, version = '1.0.0', logLevel = 'info', nodeEnv = 'development' } = options;

  const serviceMetadata = {
    service: {
      name: serviceName,
      version,
    },
  };

  if (nodeEnv !== 'production') {
    return pino({
      level: logLevel,
      base: serviceMetadata,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    } as LoggerOptions);
  }

  const gcpConfig = createGcpLoggingPinoConfig();
  return pino({
    ...gcpConfig,
    level: logLevel,
    base: {
      ...gcpConfig.base,
      ...serviceMetadata,
    },
  } as LoggerOptions);
}

/**
 * Service-level Pino logger for gateway-api.
 * In development the output is pretty-printed; in production it emits
 * Google Cloud Logging-compatible structured JSON.
 */
export const logger = createLogger({
  serviceName: 'gateway-api',
  logLevel: config.logLevel,
  nodeEnv: config.nodeEnv,
});
