# ADR-003: Use Cloud Pub/Sub for Inter-Service Messaging

**Date:** 2024-01-01  
**Status:** Accepted

---

## Context

Resume processing is a multi-step pipeline where each stage is independent and potentially long-running:

1. Ingestor downloads and stores raw resume text (~seconds)
2. AI Worker extracts structured fields and generates embeddings (~10–30 seconds per resume using Vertex AI)
3. Search Base indexes the resulting embedding vector (~milliseconds)

If these steps were synchronous (direct HTTP calls), the Ingestor would block waiting for the AI Worker to finish, increasing latency and creating tight coupling. A single slow or failed AI Worker call would cascade into an Ingestor timeout.

Additionally, the services run on Cloud Run with `--min-instances=0` (scale-to-zero). They must be activated on demand rather than maintaining persistent connections.

Only message identifiers (e.g., `{ resumeId }`) are passed through Pub/Sub messages — never full resume payloads — to keep messages small and avoid hitting Pub/Sub message size limits.

## Decision

Asynchronous communication between the Ingestor, AI Worker, Search Base, and DLQ Notifier uses Google Cloud Pub/Sub. Each processing stage publishes a message containing only the `resumeId` to a topic; the next stage subscribes and fetches the full payload from Firestore.

## Alternatives Considered

**Kafka:** Provides higher throughput and richer streaming semantics. Rejected because Kafka requires persistent infrastructure (brokers, ZooKeeper/KRaft), which conflicts with the scale-to-zero, low-cost GCP-native design goal.

**RabbitMQ:** Similar reasoning to Kafka — requires a persistent broker process. Adds operational overhead without a compelling advantage over the managed Pub/Sub service.

**Direct HTTP calls between services:** Simple but synchronous. Rejected because it creates tight coupling, blocks callers, and fails non-gracefully when downstream services are cold-starting (Cloud Run scale-to-zero).

## Consequences

- **Easier:** Built-in retry and dead-letter queue (DLQ) support in Pub/Sub — failed messages are automatically routed to the `dead-letter-queue` topic after `max-delivery-attempts`.
- **Easier:** Each pipeline stage can scale independently; the AI Worker can process messages at its own pace without blocking the Ingestor.
- **Harder:** Requires a Pub/Sub emulator for local development (provided via the `firebase-emulator` Docker container).
- **Harder:** The pipeline introduces eventual consistency — a resume written to Firestore by the Ingestor will not appear in search results until the AI Worker and Search Base have processed it.
- **Follow-on:** Topics, subscriptions, and dead-letter policies must be provisioned before deployment. See [Deployment Guide](../deployment.md).
