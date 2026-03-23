import { z } from 'zod';
import type { IMessagingService } from './interfaces/messaging-service.js';
import { SmtpMessagingService } from './services/smtp-messaging-service.js';

/**
 * Configuration options for the Hermes messaging layer.
 *
 * Pass these options to {@link initializeMessaging} to configure the
 * messaging transport explicitly, or use {@link initializeMessagingFromEnv}
 * to load them automatically from environment variables.
 */
export interface MessagingOptions {
  /** SMTP server hostname (e.g. `'smtp.example.com'`). */
  host: string;

  /** SMTP server port (e.g. `587` for STARTTLS, `465` for SSL, `25` for plain). */
  port: number;

  /**
   * Whether to use TLS for the connection.
   * - `true` — wrap the connection in TLS from the start (port 465 / SMTPS).
   * - `false` — use plain or STARTTLS (ports 25 / 587).
   * Defaults to `false`.
   */
  secure?: boolean;

  /** SMTP authentication username. Omit for unauthenticated relays. */
  user?: string;

  /** SMTP authentication password. Omit for unauthenticated relays. */
  password?: string;

  /** The `From` address used for all outgoing messages (e.g. `'noreply@example.com'`). */
  from: string;
}

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
let _service: IMessagingService | undefined;

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
export function initializeMessaging(options: MessagingOptions): void {
  if (_service) return;
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
export function initializeMessagingFromEnv(): void {
  if (_service) return;
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
export function getMessagingService(): IMessagingService {
  if (!_service) {
    throw new Error(
      'Hermes has not been initialised. ' +
        'Call initializeMessaging() or initializeMessagingFromEnv() before using getMessagingService().',
    );
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
export function _resetMessagingForTesting(): void {
  _service = undefined;
}
