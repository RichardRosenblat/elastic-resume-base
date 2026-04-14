"""Application configuration for the ingestor service.

Settings are read from environment variables and optional config files.

At import time, this module calls :func:`toolbox_py.load_config_yaml` to load
monorepo YAML configuration (``config.yaml`` or ``configs.yaml``), merge
``systems.shared`` with ``systems.ingestor-service``, and seed any missing
environment variables.  Variables already present in the process environment
always take precedence.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from toolbox_py import load_config_yaml


class Settings(BaseSettings):
    """Runtime settings for the ingestor service.

    All fields can be overridden by the corresponding environment variable
    (case-insensitive).  A ``.env`` file in the working directory is loaded
    automatically when present.

    Attributes:
        gcp_project_id: Google Cloud project ID used by Firestore and Pub/Sub.
            Defaults to an empty string (suitable for local dev without GCP).
        port: TCP port the service listens on.  Defaults to ``8001``.
        log_level: Root logging level string (e.g. ``"INFO"``, ``"DEBUG"``).
            Defaults to ``"INFO"``.
        google_application_credentials: Path to a GCP service-account JSON key
            file used for local development.  When non-empty the path is
            exported to the ``GOOGLE_APPLICATION_CREDENTIALS`` environment
            variable before any GCP client is created.  Leave empty in
            production where Application Default Credentials are provided by
            the hosting environment (Cloud Run).
        firestore_collection_resumes: Firestore collection name for resume
            documents.  Defaults to ``"resumes"``.
        pubsub_topic_resume_ingested: Pub/Sub topic name to publish to after
            a resume is ingested.  Defaults to ``"resume-ingested"``.
        pubsub_topic_dlq: Pub/Sub topic name for the dead-letter queue.
            Defaults to ``"dead-letter-queue"``.
        sheets_link_column: Default column header in Google Sheets that contains
            Google Drive links to resume files.  Defaults to ``"resume_link"``.
        http_request_timeout: Maximum seconds a single HTTP request to this
            service may take before a 504 Gateway Timeout is returned.
            Defaults to ``120``.  Health endpoints are excluded from this limit.
        rate_limit_per_minute: Maximum number of API requests accepted from a
            single client IP per minute.  Exceeding this triggers an HTTP 429
            response.  Defaults to ``60``.
        ingest_concurrency: Maximum number of Drive file downloads processed
            concurrently during a spreadsheet / sheet ingestion run.  A
            semaphore of this size limits simultaneous Drive API calls to
            prevent rate-limiting.  Defaults to ``10``.
        encrypt_kms_key_name: Fully-qualified Cloud KMS key name used to
            encrypt the raw resume text before persisting to Firestore (e.g.
            ``projects/my-proj/locations/global/keyRings/my-ring/cryptoKeys/my-key``).
            When empty, raw text is stored as plain text — suitable for local
            development only.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    gcp_project_id: str = ""
    port: int = 8001
    log_level: str = "INFO"
    google_application_credentials: str = ""
    firestore_collection_resumes: str = "resumes"
    pubsub_topic_resume_ingested: str = "resume-ingested"
    pubsub_topic_dlq: str = "dead-letter-queue"
    sheets_link_column: str = "resume_link"
    http_request_timeout: int = 120
    rate_limit_per_minute: int = 60
    ingest_concurrency: int = 10
    encrypt_kms_key_name: str = ""


load_config_yaml("ingestor-service")

settings = Settings()
