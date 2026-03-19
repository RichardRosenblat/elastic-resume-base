import { Logger } from 'pino';
/**
 * Options for configuring the Pino logger instance.
 */
export interface CreateLoggerOptions {
    /**
     * The name of the service, embedded in every log line as
     * `service.name` for structured log viewers (e.g. Cloud Logging).
     */
    serviceName: string;
    /**
     * Semantic version string for the service (e.g. `"1.0.0"`).
     * Embedded as `service.version` in every log line.
     * @defaultValue `"1.0.0"`
     */
    version?: string;
    /**
     * Pino log level string (e.g. `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`).
     * @defaultValue `"info"`
     */
    logLevel?: string;
    /**
     * Node.js environment string.  When **not** `"production"`, logs are
     * pretty-printed to the console via `pino-pretty` for human readability.
     * In production the logger emits structured JSON formatted for
     * Google Cloud Logging.
     * @defaultValue `"development"`
     */
    nodeEnv?: string;
}
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
export declare function createLogger(options: CreateLoggerOptions): Logger;
//# sourceMappingURL=createLogger.d.ts.map