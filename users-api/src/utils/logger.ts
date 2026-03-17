import { LoggerOptions, pino } from 'pino';
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';
import { config } from '../config.js';

const logLevel = config.logLevel ?? 'info';

const serviceMetadata = {
  service: {
    name: 'users-api',
    version: '1.0.0',
  },
};

let finalConfig;

if (config.nodeEnv !== 'production') {
  finalConfig = {
    level: logLevel,
    base: serviceMetadata,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  };
} else {
  const gcpConfig = createGcpLoggingPinoConfig();

  finalConfig = {
    ...gcpConfig,
    level: logLevel,
    base: {
      ...gcpConfig.base,
      ...serviceMetadata,
    },
  };
}

export const logger = pino(finalConfig as LoggerOptions);
