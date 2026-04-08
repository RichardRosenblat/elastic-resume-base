# DLQ Notifier

A Python microservice that monitors the Dead Letter Queue (DLQ) Pub/Sub topic,
stores structured notification records in Firestore, and sends email alerts when
failed messages are detected.  When a message is routed to the `dead-letter-queue`
topic after exhausting its maximum delivery attempts, the DLQ Notifier consumes it,
persists a notification record to Firestore, and dispatches an email alert to the
configured recipients for manual investigation and re-processing.

## Responsibilities

| Concern | Handled by |
|---|---|
| Dead-letter message consumption | ✅ DLQ Notifier (Pub/Sub push subscription) |
| Failure context extraction | ✅ DLQ Notifier (`DlqMessagePayload` model) |
| Notification persistence | ✅ DLQ Notifier (Firestore `notifications` collection, 30-day TTL) |
| Email alert delivery | ✅ DLQ Notifier (`NotificationService` via Hermes SMTP) |
| Message acknowledgement | ✅ DLQ Notifier (always HTTP 200 on valid envelope) |
| User notification REST API | ✅ DLQ Notifier (proxied by Gateway) |
| Re-processing failed messages | ❌ Manual operator action |

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/pubsub/push` | Receives Pub/Sub push messages from `dead-letter-queue` |
| `GET` | `/api/v1/notifications` | Get the authenticated user's notifications |
| `GET` | `/api/v1/notifications/system` | Get system-level notifications (admin only) |
| `PATCH` | `/api/v1/notifications/{id}/read` | Mark a notification as read |
| `DELETE` | `/api/v1/notifications/{id}` | Delete a notification |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |
| `GET` | `/api/v1/docs` | Swagger UI |
| `GET` | `/api/v1/redoc` | ReDoc UI |

Notification endpoints use `X-User-Id` and `X-User-Role` headers injected by the Gateway for authorization.

---

## Configuration

All settings are sourced from `config.yaml` (see `systems.dlq-notifier`) and
can be overridden by environment variables.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | – | `8007` | TCP port the service listens on |
| `LOG_LEVEL` | – | `INFO` | Logging verbosity |
| `PUBSUB_TOPIC_DLQ` | – | `dead-letter-queue` | DLQ Pub/Sub topic name |
| `GCP_PROJECT_ID` | – | (from shared) | GCP project ID for Firestore (defaults to `FIREBASE_PROJECT_ID`) |
| `FIREBASE_PROJECT_ID` | – | `demo-elastic-resume-base` | Firebase project ID |
| `FIRESTORE_COLLECTION_NOTIFICATIONS` | – | `notifications` | Firestore collection for notification records |
| `NOTIFICATION_TTL_DAYS` | – | `30` | Days before old notifications are purged |
| `SMTP_HOST` | ✓ | – | SMTP server hostname (leave empty to disable email) |
| `SMTP_PORT` | – | `587` | SMTP server port |
| `SMTP_SECURE` | – | `false` | Use TLS from the start (SMTPS) |
| `SMTP_USER` | – | – | SMTP authentication username |
| `SMTP_PASSWORD` | – | – | SMTP authentication password |
| `SMTP_FROM` | ✓ | – | Sender `From` address |
| `NOTIFICATION_RECIPIENTS` | ✓ | – | Comma-separated recipient email addresses |
| `GOOGLE_APPLICATION_CREDENTIALS` | – | – | Path to GCP service-account key (local dev only) |
| `HTTP_REQUEST_TIMEOUT` | – | `300` | Maximum seconds a single HTTP request may take |

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
