/**
 * @module @elastic-resume-base/hermes
 *
 * Hermes is the **sole messaging abstraction layer** for Elastic Resume Base
 * microservices. It decouples services from any specific messaging provider
 * (SMTP, SendGrid, Slack, etc.) so that swapping transports requires only a
 * Hermes configuration change — no consuming service needs to be refactored.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { initializeMessagingFromEnv, getMessagingService } from '@elastic-resume-base/hermes';
 *
 * // Call once at application startup (after config.yaml has been loaded).
 * initializeMessagingFromEnv();
 *
 * // Later, anywhere in your service:
 * const messaging = getMessagingService();
 * await messaging.send({
 *   to: 'ops@example.com',
 *   subject: 'Job failed',
 *   body: 'The DLQ job resume-ingestion-001 failed.',
 * });
 * ```
 */
export type { MessagingOptions } from './messaging.js';
export { initializeMessaging, initializeMessagingFromEnv, getMessagingService, _resetMessagingForTesting, } from './messaging.js';
export type { IMessagingService, Message } from './interfaces/messaging-service.js';
export { SmtpMessagingService } from './services/smtp-messaging-service.js';
//# sourceMappingURL=index.d.ts.map