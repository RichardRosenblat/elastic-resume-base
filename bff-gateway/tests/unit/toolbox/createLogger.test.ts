/**
 * Unit tests for createLogger.
 * Tests that the logger factory returns a valid Pino logger instance.
 */

jest.mock('@google-cloud/pino-logging-gcp-config', () => ({
  createGcpLoggingPinoConfig: jest.fn(() => ({
    base: { gcpKey: 'value' },
  })),
}));

import { createLogger } from '../../../../shared/Toolbox/src/createLogger.js';

describe('createLogger', () => {
  it('returns a logger with info, warn, error, debug, trace methods', () => {
    const logger = createLogger({ serviceName: 'test-service', nodeEnv: 'test' });
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.trace).toBe('function');
  });

  it('uses logLevel from options', () => {
    const logger = createLogger({ serviceName: 'test-service', logLevel: 'debug', nodeEnv: 'test' });
    expect(logger.level).toBe('debug');
  });

  it('defaults logLevel to "info"', () => {
    const logger = createLogger({ serviceName: 'test-service', nodeEnv: 'test' });
    expect(logger.level).toBe('info');
  });

  it('does not throw in production mode', () => {
    expect(() =>
      createLogger({ serviceName: 'test-service', logLevel: 'info', nodeEnv: 'production' }),
    ).not.toThrow();
  });

  it('does not throw in development mode', () => {
    expect(() =>
      createLogger({ serviceName: 'test-service', logLevel: 'info', nodeEnv: 'development' }),
    ).not.toThrow();
  });
});
