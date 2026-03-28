# Changelog — @elastic-resume-base/hermes

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

**Messaging (SMTP)**

- `initializeMessaging(options: MessagingOptions)` — configures the messaging singleton
  with an explicit options object.
- `initializeMessagingFromEnv()` — configures the messaging singleton by reading
  SMTP settings from environment variables / `config.yaml`.
- `getMessagingService(): IMessagingService` — returns the singleton messaging service
  after `initializeMessaging[FromEnv]` has been called.
- `IMessagingService` interface — abstraction over any messaging back-end.
- `Message` type — `{ to: string; subject: string; body: string }`.
- `MessagingOptions` type — SMTP host, port, credentials, and sender address.
- `SmtpMessagingService` class — concrete `IMessagingService` backed by Nodemailer SMTP.

**Pub/Sub (Google Cloud — optional peer dependency)**

- `initializePubSub(projectId: string)` — initialises the Pub/Sub singleton with an
  explicit GCP project ID.
- `initializePubSubFromEnv()` — initialises the Pub/Sub singleton by reading
  `GCP_PROJECT_ID` from the environment.
- `getPublisher(): IPubSubPublisher` — returns the singleton publisher after
  `initializePubSub[FromEnv]` has been called.
- `IPubSubPublisher` interface — abstraction over any Pub/Sub back-end.
- `PubSubPublisher` class — concrete `IPubSubPublisher` backed by `@google-cloud/pubsub`
  (optional peer dependency; install `@google-cloud/pubsub >=4.0.0` to enable).
