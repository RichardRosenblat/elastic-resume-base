# Cloud Deployment Guide

This document covers provisioning GCP resources and deploying Elastic Resume Base services to Cloud Run. For initial GCP and Firebase project setup, see [Initial Setup](initial-setup.md).

---

## Prerequisites

- GCP project with billing enabled (see [Initial Setup](initial-setup.md))
- `gcloud` CLI authenticated:
  ```bash
  gcloud auth login
  gcloud config set project YOUR_PROJECT_ID
  ```
- Docker installed locally for building images
- Firebase CLI authenticated:
  ```bash
  firebase login
  ```

---

## GCP Services to Provision

| Service | GCP Resource | Notes |
|---|---|---|
| BFF Gateway | Cloud Run | `--min-instances=0`, `--max-instances=10` |
| Users API | Cloud Run | `--min-instances=0` |
| Ingestor Service | Cloud Run | `--min-instances=0`, triggered via HTTP |
| AI Worker | Cloud Run | `--min-instances=0`, triggered via Pub/Sub push |
| Search Base | Cloud Run | `--min-instances=1` (FAISS index in memory) |
| File Generator | Cloud Run | `--min-instances=0` |
| Document Reader | Cloud Run | `--min-instances=0` |
| DLQ Notifier | Cloud Run | `--min-instances=0`, triggered via Pub/Sub push |
| Database | Firestore (Native mode) | |
| Messaging | Cloud Pub/Sub | Topics: `resume-ingested`, `resume-extracted`, `resume-indexed`, `dead-letter-queue` |
| Secrets | Cloud KMS | Key ring: `elastic-resume-keyring`, Key: `resume-pii-key` |
| Auth | Firebase Authentication | Google SSO provider enabled |
| Frontend | Firebase Hosting | |

---

## Pub/Sub Topics and Subscriptions

Create topics and push subscriptions before deploying services:

```bash
# Create topics
gcloud pubsub topics create resume-ingested
gcloud pubsub topics create resume-extracted
gcloud pubsub topics create resume-indexed
gcloud pubsub topics create dead-letter-queue

# Push subscription for AI Worker
gcloud pubsub subscriptions create ai-worker-sub \
  --topic=resume-extracted \
  --push-endpoint=https://<ai-worker-url>/pubsub/push \
  --dead-letter-topic=dead-letter-queue \
  --max-delivery-attempts=5

# Push subscription for Search Base indexing
gcloud pubsub subscriptions create search-index-sub \
  --topic=resume-indexed \
  --push-endpoint=https://<search-base-url>/pubsub/push \
  --dead-letter-topic=dead-letter-queue \
  --max-delivery-attempts=5

# Push subscription for DLQ Notifier
gcloud pubsub subscriptions create dlq-notifier-sub \
  --topic=dead-letter-queue \
  --push-endpoint=https://<dlq-notifier-url>/pubsub/push
```

Replace `<ai-worker-url>`, `<search-base-url>`, and `<dlq-notifier-url>` with the Cloud Run service URLs obtained after the initial deployment.

---

## Building and Pushing Docker Images

```bash
# Authenticate Docker with Google Container Registry
gcloud auth configure-docker

PROJECT_ID=your-gcp-project-id
REGION=us-central1
REGISTRY=gcr.io/$PROJECT_ID

# Build and push BFF Gateway
docker build -t $REGISTRY/bff-gateway:latest \
  -f bff-gateway/Dockerfile .
docker push $REGISTRY/bff-gateway:latest

# Build and push Users API
docker build -t $REGISTRY/users-api:latest \
  -f users-api/Dockerfile .
docker push $REGISTRY/users-api:latest

# Build and push Python services (repeat for each)
docker build -t $REGISTRY/ingestor-service:latest ingestor-service/
docker push $REGISTRY/ingestor-service:latest

docker build -t $REGISTRY/ai-worker:latest ai-worker/
docker push $REGISTRY/ai-worker:latest

docker build -t $REGISTRY/search-base:latest search-base/
docker push $REGISTRY/search-base:latest

docker build -t $REGISTRY/file-generator:latest file-generator/
docker push $REGISTRY/file-generator:latest

docker build -t $REGISTRY/document-reader:latest document-reader/
docker push $REGISTRY/document-reader:latest

docker build -t $REGISTRY/dlq-notifier:latest dlq-notifier/
docker push $REGISTRY/dlq-notifier:latest
```

---

## Deploying to Cloud Run

```bash
REGION=us-central1
REGISTRY=gcr.io/$PROJECT_ID

# BFF Gateway (public-facing)
gcloud run deploy bff-gateway \
  --image=$REGISTRY/bff-gateway:latest \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="NODE_ENV=production,FIREBASE_PROJECT_ID=$PROJECT_ID"

# Users API (internal — invoked by BFF Gateway only)
gcloud run deploy users-api \
  --image=$REGISTRY/users-api:latest \
  --region=$REGION \
  --platform=managed \
  --no-allow-unauthenticated \
  --min-instances=0 \
  --set-env-vars="NODE_ENV=production,FIREBASE_PROJECT_ID=$PROJECT_ID"

# Search Base (min-instances=1 to keep FAISS index warm)
gcloud run deploy search-base \
  --image=$REGISTRY/search-base:latest \
  --region=$REGION \
  --platform=managed \
  --no-allow-unauthenticated \
  --min-instances=1 \
  --set-env-vars="FIREBASE_PROJECT_ID=$PROJECT_ID"

# Remaining services follow the same pattern with --min-instances=0
```

---

## IAM Roles

Grant the following IAM roles to the Cloud Run service accounts:

| Service | Required Roles |
|---|---|
| AI Worker | `roles/aiplatform.user`, `roles/datastore.user`, `roles/cloudkms.cryptoKeyEncrypterDecrypter` |
| Ingestor | `roles/datastore.user`, `roles/pubsub.publisher` |
| Search Base | `roles/datastore.user`, `roles/pubsub.subscriber`, `roles/aiplatform.user`, `roles/cloudkms.cryptoKeyDecrypter` |
| File Generator | `roles/datastore.user`, `roles/cloudtranslate.user`, `roles/cloudkms.cryptoKeyDecrypter` |
| Document Reader | `roles/cloudvision.user` |
| DLQ Notifier | `roles/pubsub.subscriber` |
| BFF Gateway | `roles/firebase.sdkAdminServiceAgent` |
| Users API | `roles/datastore.user`, `roles/drive.readonly` (via service account key) |

```bash
# Example: grant AI Worker service account the required roles
SA=ai-worker@$PROJECT_ID.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
```

---

## Environment Variables in Production

In production, set environment variables via Cloud Run `--set-env-vars` or store secrets in **Google Secret Manager** and inject them via `--set-secrets`. Never commit secrets to source control.

Ensure the following emulator-related variables are **not set** (or set to empty strings) in production so the SDKs connect to real GCP services:

```bash
# These should be ABSENT or empty in production
FIRESTORE_EMULATOR_HOST=
FIREBASE_AUTH_EMULATOR_HOST=
PUBSUB_EMULATOR_HOST=
```

---

## Related Documents

- [Initial Setup](initial-setup.md) — GCP and Firebase project initialization
- [Docker Orchestration](docker-orchestration.md) — local development with Docker Compose
- [Troubleshooting](troubleshooting.md) — common deployment and runtime issues
- [ADR-002: BFF Gateway](adr/ADR-002-bff-gateway-pattern.md) — rationale for the gateway pattern
- [ADR-003: Cloud Pub/Sub](adr/ADR-003-pubsub-async-messaging.md) — Pub/Sub design decisions
