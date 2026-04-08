# DLQ Notifier

A Python microservice that monitors the Dead Letter Queue (DLQ) Pub/Sub topic
and sends email notifications when failed messages are detected.  When a
message is routed to the `dead-letter-queue` topic after exhausting its maximum
delivery attempts, the DLQ Notifier consumes it, extracts relevant failure
context, and dispatches an email alert to the configured recipients for manual
investigation and re-processing.

## Responsibilities

| Concern | Handled by |
|---|---|
| Dead-letter message consumption | ✅ DLQ Notifier (Pub/Sub push subscription) |
| Failure context extraction | ✅ DLQ Notifier (`DlqMessagePayload` model) |
| Email alert delivery | ✅ DLQ Notifier (`NotificationService` via Hermes SMTP) |
| Message acknowledgement | ✅ DLQ Notifier (always HTTP 200 on valid envelope) |
| Data persistence | ❌ Stateless — no Firestore writes |
| Re-processing failed messages | ❌ Manual operator action |

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/pubsub/push` | Receives Pub/Sub push messages from `dead-letter-queue` |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |
| `GET` | `/api/v1/docs` | Swagger UI |
| `GET` | `/api/v1/redoc` | ReDoc UI |

---

## Configuration

All settings are sourced from `config.yaml` (see `systems.dlq-notifier`) and
can be overridden by environment variables.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | – | `8007` | TCP port the service listens on |
| `LOG_LEVEL` | – | `INFO` | Logging verbosity |
| `PUBSUB_TOPIC_DLQ` | – | `dead-letter-queue` | DLQ Pub/Sub topic name |
| `SMTP_HOST` | ✓ | – | SMTP server hostname |
| `SMTP_PORT` | – | `587` | SMTP server port |
| `SMTP_SECURE` | – | `false` | Use TLS from the start (SMTPS) |
| `SMTP_USER` | – | – | SMTP authentication username |
| `SMTP_PASSWORD` | – | – | SMTP authentication password |
| `SMTP_FROM` | ✓ | – | Sender `From` address |
| `NOTIFICATION_RECIPIENTS` | ✓ | – | Comma-separated recipient email addresses |
| `GOOGLE_APPLICATION_CREDENTIALS` | – | – | Path to GCP service-account key (local dev only) |

---

## Message Format

The DLQ Notifier accepts any valid JSON Pub/Sub push payload.  All fields are
optional to support messages from different upstream services:

```json
{
  "resumeId": "abc-123",
  "error": "Human-readable error description",
  "service": "ingestor",
  "stage": "download",
  "errorType": "DOWNLOAD_ERROR"
}
```

Unknown extra fields are silently ignored.

---

## Running Locally

```bash
# Install dev dependencies
pip install -r requirements/requirements-dev.txt

# Start the service (reads config.yaml from the monorepo root)
uvicorn app.main:app --host 0.0.0.0 --port 8007 --reload

# Run tests
pytest
```

---

## Running Tests

```bash
cd apps/dlq-notifier
pip install -r requirements/requirements-dev.txt
pytest
```
