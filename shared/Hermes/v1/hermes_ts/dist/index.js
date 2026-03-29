/**
 * @module @elastic-resume-base/hermes
 *
 * Hermes is the **sole messaging abstraction layer** for Elastic Resume Base
 * microservices. It decouples services from any specific messaging provider
 * (SMTP, SendGrid, Slack, etc.) so that swapping transports requires only a
 * Hermes configuration change — no consuming service needs to be refactored.
 *
 * ## Quick Start — Messaging (SMTP)
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
 *
 * ## Quick Start — Pub/Sub (Google Cloud)
 *
 * ```typescript
 * import { initializePubSubFromEnv, getPublisher } from '@elastic-resume-base/hermes';
 *
 * // Call once at application startup — reads GCP_PROJECT_ID from environment.
 * initializePubSubFromEnv();
 *
 * // Later, anywhere in your service:
 * const publisher = getPublisher();
 * await publisher.publish('resume-ingested', { resumeId: 'abc-123', status: 'ok' });
 * ```
 */
export { initializeMessaging, initializeMessagingFromEnv, getMessagingService, _resetMessagingForTesting, } from './messaging.js';
// Concrete messaging implementations
export { SmtpMessagingService } from './services/smtp-messaging-service.js';
// ---------------------------------------------------------------------------
// Pub/Sub (Google Cloud)
// ---------------------------------------------------------------------------
// Pub/Sub initialisation (must be called before using getPublisher)
export { initializePubSub, initializePubSubFromEnv, getPublisher, _resetPubSubForTesting, } from './pubsub.js';
// Concrete Pub/Sub implementations
export { PubSubPublisher } from './services/pub-sub-publisher.js';
//# sourceMappingURL=index.js.map