"""Application configuration for the AI Worker service.

``load_config_yaml`` is called at module import time so that any values
defined in ``config.yaml`` are available before ``Settings()`` reads
environment variables.  This mirrors the TypeScript pattern where
``loadConfigYaml`` is the first thing called in the service entry point.

All configuration is loaded from environment variables (or a ``.env`` file
during local development) using ``pydantic-settings``.  Never access
``os.environ`` directly in application code — always use the
:data:`settings` singleton.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.utils.load_config_yaml import load_config_yaml

# Populate os.environ from config.yaml BEFORE pydantic-settings reads it.
load_config_yaml("ai-worker")


class Settings(BaseSettings):
    """Centralised, validated application settings.

    All fields map to uppercase environment variables of the same name
    (e.g. ``project_id`` → ``PROJECT_ID``).

    Attributes:
        project_id: GCP project identifier used for Vertex AI and Synapse.
        pubsub_output_topic: Pub/Sub topic the AI Worker publishes processed
            events to (``resume_indexing``).
        pubsub_dlq_topic: Dead-letter Pub/Sub topic for failed messages.
        pubsub_emulator_host: Optional Pub/Sub emulator address for local dev.
        firestore_resumes_collection: Firestore collection for core resume
            documents.
        firestore_embeddings_collection: Firestore collection for embedding
            vectors (separate from resume data).
        firestore_emulator_host: Optional Firestore emulator address for local
            dev.
        vertex_ai_location: GCP region for Vertex AI API calls.
        vertex_ai_extraction_model: Generative model for structured extraction.
        vertex_ai_embedding_model: Embedding model name.
        vertex_ai_max_calls_per_minute: Maximum Vertex AI API calls per minute.
            Enforced inside :class:`~app.services.vertex_ai_service.VertexAIService`.
        rate_limit_per_minute: Maximum HTTP requests per minute to the push
            endpoint. Enforced by ``slowapi``.
        dlq_alert_recipient: Email address for DLQ failure alerts via Hermes.
        log_level: Python logging level.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    project_id: str
    pubsub_output_topic: str = "resume_indexing"
    pubsub_dlq_topic: str = "dead-letter-queue"
    pubsub_emulator_host: str | None = None
    firestore_resumes_collection: str = "resumes"
    firestore_embeddings_collection: str = "resume_embeddings"
    firestore_emulator_host: str | None = None
    vertex_ai_location: str = "us-central1"
    vertex_ai_extraction_model: str = "gemini-1.5-flash"
    vertex_ai_embedding_model: str = "text-multilingual-embedding-002"
    vertex_ai_max_calls_per_minute: int = 60
    rate_limit_per_minute: int = 30
    dlq_alert_recipient: str = "ops@example.com"
    log_level: str = "INFO"


settings = Settings()  # type: ignore[call-arg]
