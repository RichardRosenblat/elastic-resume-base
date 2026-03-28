# Changelog — elastic-resume-base-hermes (Python)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

**Messaging (SMTP)**

- `initialize_messaging(options: MessagingOptions)` — configures the messaging singleton
  with an explicit options object.
- `initialize_messaging_from_env()` — configures the messaging singleton by reading
  SMTP settings from environment variables / `config.yaml`.
- `get_messaging_service() -> IMessagingService` — returns the singleton messaging service
  after `initialize_messaging[_from_env]` has been called.
- `IMessagingService` Protocol — abstraction over any messaging back-end.
- `Message` dataclass — `to: str`, `subject: str`, `body: str`.
- `MessagingOptions` dataclass — SMTP host, port, credentials, and sender address.
- `SmtpMessagingService` class — concrete `IMessagingService` backed by Python's
  `smtplib`; mirrors `SmtpMessagingService` from the TypeScript package.

**Pub/Sub (Google Cloud — optional extra)**

- `initialize_pubsub(project_id: str)` — initialises the Pub/Sub singleton with an
  explicit GCP project ID.
- `initialize_pubsub_from_env()` — initialises the Pub/Sub singleton by reading
  `GCP_PROJECT_ID` from the environment.
- `get_publisher() -> IPublisher` — returns the singleton publisher after
  `initialize_pubsub[_from_env]` has been called.
- `IPublisher` Protocol — abstraction over any Pub/Sub back-end.
- `PubSubPublisher` class — concrete `IPublisher` backed by `google-cloud-pubsub`
  (optional; install `elastic-resume-base-hermes[pubsub]` to enable).
