"""Application configuration loaded from environment variables.

All configuration is sourced from environment variables, which are in turn
populated from ``config.yaml`` (systems.shared + systems.ingestor-service) by
:func:`toolbox.load_config_yaml` at startup before this module is imported.

Keys already present in the environment are never overridden (twelve-factor
app pattern).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated application settings.

    Attributes:
        port: HTTP port the service listens on.  Defaults to 8001.
        log_level: Logging level string (e.g. ``"info"``).
        gcp_project_id: Google Cloud project ID (for Pub/Sub and Firestore).
        firestore_emulator_host: Firestore emulator address (local dev only).
        pubsub_emulator_host: Pub/Sub emulator address (local dev only).
        firestore_resumes_collection: Firestore collection for resume documents.
        pubsub_ingestor_topic: Pub/Sub topic for resume-ingested events.
        pubsub_dlq_topic: Pub/Sub topic for dead-letter-queue messages.
        google_service_account_key: Optional path to a service-account JSON key
            file.  When omitted, Application Default Credentials are used.
        ingest_rate_limit_max_requests: Maximum number of ``POST /ingest``
            requests allowed within the rate-limit window.  Read from
            ``INGEST_RATE_LIMIT_MAX_REQUESTS`` (config.yaml).
        ingest_rate_limit_window_seconds: Duration of the rate-limit sliding
            window in seconds.  Read from ``INGEST_RATE_LIMIT_WINDOW_SECONDS``
            (config.yaml).
        max_ai_calls_per_batch: Maximum number of resumes that a single ingest
            batch may produce.  Each resume triggers one downstream AI call so
            this caps unexpected Vertex AI spend.  ``0`` means unlimited.
            Read from ``MAX_AI_CALLS_PER_BATCH`` (config.yaml).
    """

    model_config = SettingsConfigDict(
        env_file=None,
        extra="ignore",
        populate_by_name=True,
    )

    port: int = 8001
    log_level: str = "info"
    gcp_project_id: str = "demo-elastic-resume-base"
    firestore_emulator_host: str | None = None
    pubsub_emulator_host: str | None = None
    firestore_resumes_collection: str = "resumes"
    pubsub_ingestor_topic: str = "resume-ingested"
    pubsub_dlq_topic: str = "dead-letter-queue"
    google_service_account_key: str | None = None

    # Rate limiting
    ingest_rate_limit_max_requests: int = 10
    ingest_rate_limit_window_seconds: int = 60

    # AI call budget per batch
    max_ai_calls_per_batch: int = 50


def load_settings() -> Settings:
    """Load and validate settings from the current environment.

    Returns:
        Validated :class:`Settings` instance.

    Raises:
        pydantic_core.ValidationError: If a required variable is missing or
            has an invalid value.
    """
    return Settings()
