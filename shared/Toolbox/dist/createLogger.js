import { pino } from 'pino';
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';
/**
 * Creates and returns a configured Pino {@link Logger} instance.
 *
 * - **Development / test** — pretty-printed, colourised output via
 *   `pino-pretty`.
 * - **Production** — structured JSON formatted for Google Cloud Logging,
 *   with `service.name` and `service.version` embedded in every entry.
 *
 * Typical usage in a service's `utils/logger.ts`:
 *
 * ```typescript
 * import { createLogger } from '@elastic-resume-base/toolbox';
 * import { config } from '../config.js';
 *
 * export const logger = createLogger({
 *   serviceName: 'my-service',
 *   logLevel: config.logLevel,
 *   nodeEnv: config.nodeEnv,
 * });
 * ```
 *
 * @param options - Logger configuration options.
 * @returns Configured Pino Logger instance.
 */
export function createLogger(options) {
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
        });
    }
    const gcpConfig = createGcpLoggingPinoConfig();
    return pino({
        ...gcpConfig,
        level: logLevel,
        base: {
            ...gcpConfig.base,
            ...serviceMetadata,
        },
    });
}
//# sourceMappingURL=createLogger.js.map