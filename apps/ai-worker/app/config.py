"""Application configuration for the AI Worker service.

Settings are read from environment variables and optional config files.

At import time, this module calls :func:`toolbox_py.load_config_yaml` to load
monorepo YAML configuration (``config.yaml`` or ``configs.yaml``), merge
``systems.shared`` with ``systems.ai-worker``, and seed any missing
environment variables.  Variables already present in the process environment
always take precedence.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from toolbox_py import load_config_yaml


class Settings(BaseSettings):
    """Runtime settings for the AI Worker service.

    All fields can be overridden by the corresponding environment variable
    (case-insensitive).  A ``.env`` file in the working directory is loaded
    automatically when present.

    Attributes:
        gcp_project_id: Google Cloud project ID used by Firestore, Pub/Sub,
            and Vertex AI.  Defaults to an empty string (local dev without GCP).
        port: TCP port the service listens on.  Defaults to ``8006``.
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
        vertex_ai_extraction_model: Vertex AI model used for structured field
            extraction from raw resume text.  Defaults to
            ``"gemini-1.5-flash"``.
        vertex_ai_embedding_model: Vertex AI model used for generating semantic
            embedding vectors.  Defaults to
            ``"text-multilingual-embedding-002"``.
        firestore_collection_resumes: Firestore collection name for resume
            documents.  Defaults to ``"resumes"``.
        firestore_collection_embeddings: Firestore collection name for
            embedding vectors.  Defaults to ``"embeddings"``.
        pubsub_topic_resume_ingested: Pub/Sub topic name the worker subscribes
            to for incoming ingestion events.  Defaults to
            ``"resume-ingested"``.
        pubsub_topic_resume_indexed: Pub/Sub topic name the worker publishes to
            after successful processing.  Defaults to ``"resume-indexed"``.
        pubsub_topic_dlq: Pub/Sub topic name for the dead-letter queue.
            Defaults to ``"dead-letter-queue"``.
        http_request_timeout: Maximum seconds a single HTTP request to this
            service may take before a 504 Gateway Timeout is returned.
            Defaults to ``300``.  Health endpoints are excluded from this limit.
        encrypt_kms_key_name: Fully-qualified Cloud KMS key name used to encrypt PII
            fields extracted from resumes before persisting to Firestore (e.g.
            ``projects/my-proj/locations/global/keyRings/my-ring/cryptoKeys/my-key``).
            When empty, PII fields are stored as plain text — suitable for local
            development only.
        encrypt_local_key: Fernet symmetric key used for local development encryption
            of PII fields.  When set, this key takes priority over ``encrypt_kms_key_name``
            and uses local Fernet encryption instead of Cloud KMS.  This is intended
            for local development and testing only — never use in production.
            Generate with: ``python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"``
            Must match the ``decrypt_local_key`` set in the File Generator service.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    gcp_project_id: str = ""
    port: int = 8006
    log_level: str = "INFO"
    google_application_credentials: str = ""

    vertex_ai_location: str = "us-central1"
    vertex_ai_extraction_model: str = "gemini-1.5-flash"
    vertex_ai_embedding_model: str = "text-multilingual-embedding-002"

    firestore_collection_resumes: str = "resumes"
    firestore_collection_embeddings: str = "embeddings"

    pubsub_topic_resume_ingested: str = "resume-ingested"
    pubsub_topic_resume_indexed: str = "resume-indexed"
    pubsub_topic_dlq: str = "dead-letter-queue"

    encrypt_kms_key_name: str = ""
    encrypt_local_key: str = ""

    http_request_timeout: int = 300


load_config_yaml("ai-worker")

settings = Settings()
