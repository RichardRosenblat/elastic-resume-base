# End-to-End Data Flow

This document describes the full lifecycle of data through the Elastic Resume Base system. For a high-level architecture overview, see the [architecture diagram](ERB.png) and the [Services Overview](services.md).

---

## Architecture Overview

```
                          ┌──────────────────────┐
                          │   Frontend SPA        │
                          │ (Firebase Hosting)    │
                          └──────────┬───────────┘
                                     │ HTTPS
                          ┌──────────▼───────────┐
                          │     BFF Gateway       │
                          │  (Node.js / Fastify)  │
                          └──┬──┬──┬──┬──┬───────┘
                             │  │  │  │  │
              ┌──────────────┘  │  │  │  └────────────────┐
              │         ┌───────┘  │  └───────┐           │
              ▼         ▼          ▼          ▼           ▼
         Ingestor   Search Base  File Gen  Doc Reader  Users API
         (Python)  (Python+FAISS)(Python)  (Python)  (Node.js)
              │         ▲
       Pub/Sub│         │Pub/Sub
              ▼         │
          AI Worker ────┘
          (Python)
              │
              ▼
    Firestore (via Synapse)
    Cloud KMS (PII encryption)
    Vertex AI (Gemini + Embeddings)
```

---

## Resume Ingestion Flow

1. A recruiter triggers the Ingestor Service via the BFF Gateway (`POST /api/v1/ingest`).
2. The Ingestor downloads resumes from Google Sheets/Drive using Bugle's `DrivePermissionsService`.
3. The Ingestor stores raw resume text in Firestore (`resumes` collection, status: `INGESTED`).
4. The Ingestor publishes `{ resumeId }` to the `resume-ingested` Pub/Sub topic.
5. The AI Worker receives the message and retrieves the raw text from Firestore.
6. The AI Worker calls Vertex AI Gemini 1.5 Flash to extract structured JSON fields from the raw text.
7. The AI Worker calls Vertex AI `text-multilingual-embedding-002` to generate a semantic embedding vector.
8. The AI Worker encrypts PII fields with Cloud KMS and writes the structured data and embedding to Firestore (status: `PROCESSED`).
9. The AI Worker publishes `{ resumeId }` to the `resume-indexed` Pub/Sub topic.
10. The Search Base receives the message, fetches the embedding from Firestore, and adds the vector to the in-process FAISS index.

> **Note:** Only the `resumeId` identifier is passed through Pub/Sub messages — never the full resume payload. Each stage fetches the data it needs directly from Firestore.

---

## Search Query Flow

1. The frontend sends a search query to the BFF Gateway (`GET /api/v1/search?q=...`).
2. The BFF Gateway forwards the authenticated request to the Search Base service.
3. The Search Base generates a query embedding using Vertex AI `text-multilingual-embedding-002`.
4. The Search Base runs a FAISS similarity search to find the top-k nearest resume vectors.
5. The Search Base retrieves the full resume records from Firestore for the matched resume IDs.
6. The Search Base decrypts PII fields using Cloud KMS.
7. The ranked results flow back through the BFF Gateway to the frontend.

---

## OCR Document Flow

1. The frontend uploads a scanned document via `POST /api/v1/documents/ocr`.
2. The BFF Gateway forwards the request to the Document Reader service.
3. The Document Reader calls the Google Cloud Vision API for OCR text extraction.
4. The extracted text is returned directly to the caller.

> **No data is persisted** in the OCR flow — extracted text is returned in the response only.

---

## DLQ Failure Flow

1. Pub/Sub delivers a failed message to the `dead-letter-queue` topic after the maximum retry attempts are exhausted.
2. The DLQ Notifier receives the dead-letter message via its push subscription.
3. The DLQ Notifier sends an alert (including the original topic, message ID, and error details) to the configured Slack webhook (`DLQ_SLACK_WEBHOOK_URL`).
4. The operations team investigates and, if appropriate, re-publishes the message manually.

> See [Troubleshooting](troubleshooting.md) for guidance on diagnosing and recovering from DLQ failures.

---

## File Generation Flow

1. The frontend requests a resume document (`POST /api/v1/files/generate`).
2. The BFF Gateway forwards the request to the File Generator service.
3. The File Generator retrieves the structured resume JSON from Firestore.
4. If a translation is requested, the File Generator calls the Google Cloud Translation API.
5. The translated result is cached in the `translation-cache` Firestore collection to avoid redundant API calls.
6. The File Generator renders the final document and returns it to the caller.

---

## Data Persistence Summary

| Data | Collection / Store | Written By | Read By |
|---|---|---|---|
| Raw resume text | Firestore `resumes` | Ingestor | AI Worker |
| Structured resume JSON | Firestore `resumes` | AI Worker | Search Base, File Generator |
| Embedding vectors | Firestore `resumes` | AI Worker | Search Base |
| User profiles and roles | Firestore `users` | Users API | BFF Gateway, Users API |
| Translation cache | Firestore `translation-cache` | File Generator | File Generator |
| FAISS index | In-memory (optional volume) | Search Base | Search Base |

---

## Related Documents

- [Services Overview](services.md) — detailed description of each microservice
- [Deployment Guide](deployment.md) — provisioning Pub/Sub topics and Cloud Run services
- [ADR-003: Cloud Pub/Sub](adr/ADR-003-pubsub-async-messaging.md) — rationale for async messaging
- [ADR-004: Firestore](adr/ADR-004-firestore-database.md) — rationale for the database choice
- [ADR-005: FAISS](adr/ADR-005-faiss-vector-search.md) — rationale for in-process vector search
