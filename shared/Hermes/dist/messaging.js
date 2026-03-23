import { z } from 'zod';
import { SmtpMessagingService } from './services/smtp-messaging-service.js';
/** Zod schema for loading {@link MessagingOptions} from `process.env`. */
const messagingEnvSchema = z.object({
    SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
    SMTP_PORT: z.coerce.number().int().min(1, 'SMTP_PORT must be a positive integer'),
    SMTP_SECURE: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().min(1, 'SMTP_FROM is required'),
});
/** Singleton messaging service instance. */
let _service;
/**
 * Initialises the Hermes messaging layer with explicit configuration.
 *
 * This is the primary initialisation path when configuration is passed
 * programmatically (e.g. from a config object loaded at application startup).
 *
 * Calling this function more than once has no effect — the first call wins
 * (idempotent).
 *
 * @param options - Messaging transport configuration.
 *
 * @example
 * ```typescript
 * import { initializeMessaging } from '@elastic-resume-base/hermes';
 *
 * initializeMessaging({
 *   host: process.env.SMTP_HOST ?? 'localhost',
 *   port: Number(process.env.SMTP_PORT) || 587,
 *   from: process.env.SMTP_FROM ?? 'noreply@example.com',
 * });
 * ```
 */
export function initializeMessaging(options) {
    if (_service)
        return;
    _service = new SmtpMessagingService(options);
}
/**
 * Initialises the Hermes messaging layer from environment variables.
 *
 * Reads the following variables (all sourced from `config.yaml` via the
 * service's startup config loader):
 *
 * | Variable       | Required | Description                                      |
 * |----------------|----------|--------------------------------------------------|
 * | `SMTP_HOST`    | ✅       | SMTP server hostname                             |
 * | `SMTP_PORT`    | ✅       | SMTP server port                                 |
 * | `SMTP_SECURE`  | ❌       | `'true'` to enable TLS (default: `'false'`)      |
 * | `SMTP_USER`    | ❌       | SMTP username (omit for unauthenticated relays)  |
 * | `SMTP_PASSWORD`| ❌       | SMTP password (omit for unauthenticated relays)  |
 * | `SMTP_FROM`    | ✅       | Sender `From` address                            |
 *
 * Calling this function more than once has no effect (idempotent).
 *
 * @throws {ZodError} If any required environment variable is missing or invalid.
 *
 * @example
 * ```typescript
 * import { initializeMessagingFromEnv } from '@elastic-resume-base/hermes';
 *
 * // Call once at application startup — after config.yaml has been loaded.
 * initializeMessagingFromEnv();
 * ```
 */
export function initializeMessagingFromEnv() {
    if (_service)
        return;
    const env = messagingEnvSchema.parse(process.env);
    _service = new SmtpMessagingService({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
        from: env.SMTP_FROM,
    });
}
/**
 * Returns the initialised messaging service singleton.
 *
 * @returns The active {@link IMessagingService} instance.
 * @throws {Error} If neither {@link initializeMessaging} nor
 *   {@link initializeMessagingFromEnv} has been called.
 *
 * @example
 * ```typescript
 * import { getMessagingService } from '@elastic-resume-base/hermes';
 *
 * const messaging = getMessagingService();
 * await messaging.send({ to: 'ops@example.com', subject: 'Alert', body: 'Something failed.' });
 * ```
 */
export function getMessagingService() {
    if (!_service) {
        throw new Error('Hermes has not been initialised. ' +
            'Call initializeMessaging() or initializeMessagingFromEnv() before using getMessagingService().');
    }
    return _service;
}
/**
 * Resets the internal messaging singleton.
 *
 * **For testing only.** Call this in `afterEach` / `beforeEach` blocks to
 * ensure test isolation when testing code that calls `initializeMessaging`.
 *
 * @internal
 */
export function _resetMessagingForTesting() {
    _service = undefined;
}
//# sourceMappingURL=messaging.js.map