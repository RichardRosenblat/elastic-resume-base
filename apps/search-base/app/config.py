"""Application configuration for the Search Base service.

Settings are read from environment variables and optional config files.

At import time, this module calls :func:`toolbox_py.load_config_yaml` to load
monorepo YAML configuration (``config.yaml`` or ``configs.yaml``), merge
``systems.shared`` with ``systems.search-base``, and seed any missing
environment variables.  Variables already present in the process environment
always take precedence.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from toolbox_py import load_config_yaml


class Settings(BaseSettings):
    """Runtime settings for the Search Base service.

    All fields can be overridden by the corresponding environment variable
    (case-insensitive).  A ``.env`` file in the working directory is loaded
    automatically when present.

    Attributes:
        gcp_project_id: Google Cloud project ID used by Firestore, Pub/Sub,
            and Vertex AI.  Defaults to an empty string (local dev without GCP).
        port: TCP port the service listens on.  Defaults to ``8002``.
        log_level: Root logging level string (e.g. ``"INFO"``, ``"DEBUG"``).
            Defaults to ``"INFO"``.
        google_application_credentials: Path to a GCP service-account JSON key
            file used for local development.  When non-empty the path is
            exported to the ``GOOGLE_APPLICATION_CREDENTIALS`` environment
            variable before any GCP client is created.  Leave empty in
            production where Application Default Credentials are provided by
            the hosting environment (Cloud Run).
        vertex_ai_location: Google Cloud region for Vertex AI API calls.
            Defaults to ``"us-central1"``.
        vertex_ai_embedding_model: Vertex AI model used for generating semantic
            embedding vectors for queries.  Defaults to
            ``"text-multilingual-embedding-002"``.
        firestore_collection_resumes: Firestore collection name for resume
            documents.  Defaults to ``"resumes"``.
        firestore_collection_embeddings: Firestore collection name for
            embedding vectors.  Defaults to ``"embeddings"``.
        pubsub_topic_resume_indexed: Pub/Sub topic name the service subscribes
            to for incoming indexing events.  Defaults to ``"resume-indexed"``.
        pubsub_topic_dlq: Pub/Sub topic name for the dead-letter queue.
            Defaults to ``"dead-letter-queue"``.
        faiss_index_path: Optional file path for persisting the FAISS index
            to disk.  When empty (default), the index exists in-memory only
            and is rebuilt on service restart.  When set (e.g.
            ``"/data/faiss_index"``), the index is saved to disk and reloaded
            on startup if present.
        faiss_index_metric: Distance metric for FAISS index.  Defaults to
            ``"cosine"`` (Inner Product after L2 normalization).  Supported:
            ``"cosine"`` (IP with normalized vectors), ``"l2"`` (Euclidean).
        decrypt_kms_key_name: Fully-qualified Cloud KMS key name used to decrypt PII
            fields from resumes before returning search results (e.g.
            ``projects/my-proj/locations/global/keyRings/my-ring/cryptoKeys/my-key``).
            When empty, PII fields are assumed to be stored as plain text —
            suitable for local development only.
        local_fernet_key: Fernet symmetric key used for local development decryption
            of PII fields.  When set, this key takes priority over
            ``decrypt_kms_key_name`` and uses local Fernet decryption instead of
            Cloud KMS.  This is intended for local development and testing only —
            never use in production.  Must match the ``local_fernet_key`` set in the
            AI Worker service (which encrypts the PII fields).
            Generate with: ``python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"``
            Set via the shared ``LOCAL_FERNET_KEY`` variable in ``config.yaml``.
        http_request_timeout: Maximum seconds a single HTTP request to this
            service may take before a 504 Gateway Timeout is returned.
            Defaults to ``300``.  Health endpoints are excluded from this limit.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    gcp_project_id: str = ""
    port: int = 8002
    log_level: str = "INFO"
    google_application_credentials: str = ""

    vertex_ai_location: str = "us-central1"
    vertex_ai_embedding_model: str = "text-multilingual-embedding-002"

    firestore_collection_resumes: str = "resumes"
    firestore_collection_embeddings: str = "embeddings"

    pubsub_topic_resume_indexed: str = "resume-indexed"
    pubsub_topic_dlq: str = "dead-letter-queue"

    faiss_index_path: str = ""
    faiss_index_metric: str = "cosine"

    decrypt_kms_key_name: str = ""
    local_fernet_key: str = ""

    http_request_timeout: int = 300


load_config_yaml("search-base")

settings = Settings()
