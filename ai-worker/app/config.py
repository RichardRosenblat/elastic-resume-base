"""Application configuration for the AI Worker service.

All configuration is loaded from environment variables (or a ``.env`` file during
local development) using ``pydantic-settings``.  Never access ``os.environ``
directly in application code — always use the :data:`settings` singleton.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralised, validated application settings.

    All fields map to uppercase environment variables of the same name
    (e.g. ``project_id`` → ``PROJECT_ID``).

    Attributes:
        project_id: GCP project identifier used for Firestore and Vertex AI.
        pubsub_input_topic: Pub/Sub topic the AI Worker subscribes to
            (``resume-ingested``).
        pubsub_output_topic: Pub/Sub topic the AI Worker publishes processed
            events to (``resume-indexed``).
        pubsub_dlq_topic: Dead-letter Pub/Sub topic name for failed messages.
        firestore_resumes_collection: Firestore collection for resume documents.
        vertex_ai_location: GCP region for Vertex AI API calls
            (e.g. ``us-central1``).
        vertex_ai_extraction_model: Vertex AI generative model used for
            structured field extraction.
        vertex_ai_embedding_model: Vertex AI model used for embedding generation.
        dlq_alert_recipient: Email address for DLQ failure alerts via Hermes.
        log_level: Python logging level (``DEBUG``, ``INFO``, ``WARNING``,
            ``ERROR``, ``CRITICAL``).
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    project_id: str
    pubsub_input_topic: str = "resume-ingested"
    pubsub_output_topic: str = "resume-indexed"
    pubsub_dlq_topic: str = "dead-letter-queue"
    firestore_resumes_collection: str = "resumes"
    vertex_ai_location: str = "us-central1"
    vertex_ai_extraction_model: str = "gemini-1.5-flash"
    vertex_ai_embedding_model: str = "text-multilingual-embedding-002"
    dlq_alert_recipient: str = "ops@example.com"
    log_level: str = "INFO"


settings = Settings()  # type: ignore[call-arg]
