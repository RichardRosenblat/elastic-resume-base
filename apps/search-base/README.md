# Search Base Service

Semantic resume search microservice. Manages an in-memory FAISS vector index for fast similarity search. Subscribes to the `resume-indexed` Pub/Sub topic to receive new embeddings, exposes a search endpoint for natural language queries, and optionally persists the index to a mounted volume.

## Features

- **FAISS Vector Search**: In-memory FAISS index for fast semantic search
- **Pub/Sub Integration**: Receives `resume-indexed` events from AI Worker
- **Natural Language Queries**: Uses Vertex AI to generate query embeddings
- **PII Decryption**: Decrypts PII fields using Cloud KMS before returning results
- **Index Persistence**: Optional disk persistence for index survival across restarts
- **Index Rebuild**: Manual endpoint to rebuild index from Firestore

## Architecture

```
Pub/Sub (resume-indexed) → Search Base → FAISS Index → Search Results
                                ↓
                          Firestore (embeddings)
                                ↓
                          Firestore (resumes)
```

## API Endpoints

- `GET /api/v1/search?q=...` — Search resumes by natural language query
- `POST /api/v1/index/rebuild` — Rebuild the FAISS index from Firestore
- `POST /api/v1/pubsub/push` — Pub/Sub push endpoint for `resume-indexed` events
- `GET /health/live` — Liveness probe
- `GET /health/ready` — Readiness probe

## Configuration

Configuration is loaded from environment variables and `config.yaml`:

- `GCP_PROJECT_ID` — Google Cloud project ID
- `PORT` — HTTP port (default: 8002)
- `VERTEX_AI_LOCATION` — Vertex AI region (default: us-central1)
- `VERTEX_AI_EMBEDDING_MODEL` — Embedding model (default: text-multilingual-embedding-002)
- `FIRESTORE_COLLECTION_RESUMES` — Resume collection name (default: resumes)
- `FIRESTORE_COLLECTION_EMBEDDINGS` — Embeddings collection name (default: embeddings)
- `PUBSUB_TOPIC_RESUME_INDEXED` — Input topic name (default: resume-indexed)
- `FAISS_INDEX_PATH` — Optional disk path for index persistence (default: empty/in-memory)
- `FAISS_INDEX_METRIC` — Distance metric: cosine or l2 (default: cosine)
- `DECRYPT_KMS_KEY_NAME` — Cloud KMS key for PII decryption (default: empty)

## Development

```bash
# Install dependencies
cd apps/search-base
pip install -r requirements/requirements-dev.txt

# Run tests
pytest

# Run locally
uvicorn app.main:app --reload --port 8002
```

## Deployment

Cloud Run deployment with minimum 1 instance for warm index:

```bash
gcloud run deploy search-base \
  --image gcr.io/PROJECT_ID/search-base \
  --platform managed \
  --region us-central1 \
  --min-instances 1 \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars GCP_PROJECT_ID=PROJECT_ID
```

## Dependencies

- Python 3.11+
- FastAPI & Uvicorn
- FAISS (faiss-cpu or faiss-gpu)
- Vertex AI (google-cloud-aiplatform)
- Firestore (firebase-admin)
- Cloud KMS (google-cloud-kms)
- Shared libraries: Toolbox, Hermes, Bowltie, Synapse
