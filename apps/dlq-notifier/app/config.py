"""Application configuration for the DLQ Notifier service.

Settings are read from environment variables and optional config files.

At import time, this module calls :func:`toolbox_py.load_config_yaml` to load
monorepo YAML configuration (``config.yaml`` or ``configs.yaml``), merge
``systems.shared`` with ``systems.dlq-notifier``, and seed any missing
environment variables.  Variables already present in the process environment
always take precedence.
"""

from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from toolbox_py import load_config_yaml


class Settings(BaseSettings):
    """Runtime settings for the DLQ Notifier service.

    All fields can be overridden by the corresponding environment variable
    (case-insensitive).  A ``.env`` file in the working directory is loaded
    automatically when present.

    Attributes:
        port: TCP port the service listens on.  Defaults to ``8007``.
        log_level: Root logging level string (e.g. ``"INFO"``, ``"DEBUG"``).
            Defaults to ``"INFO"``.
        google_application_credentials: Path to a GCP service-account JSON key
            file used for local development.  When non-empty the path is
            exported to the ``GOOGLE_APPLICATION_CREDENTIALS`` environment
            variable before any GCP client is created.  Leave empty in
            production where Application Default Credentials are provided by
            the hosting environment (Cloud Run).
        gcp_project_id: GCP project ID for Firestore.
        firebase_project_id: Firebase project ID (fallback for Firestore init).
        pubsub_topic_dlq: Pub/Sub topic name for the dead-letter queue.
            Defaults to ``"dead-letter-queue"``.
        http_request_timeout: Maximum seconds a single HTTP request to this
            service may take before a 504 Gateway Timeout is returned.
            Defaults to ``300``.  Health endpoints are excluded from this limit.
        firestore_collection_notifications: Firestore collection name where
            notifications are persisted.  Defaults to ``"notifications"``.
        notification_ttl_days: Number of days after which old notifications are
            automatically deleted.  Defaults to ``30``.
        smtp_host: SMTP server hostname.
        smtp_port: SMTP server port (e.g. 587 for STARTTLS, 465 for SSL).
        smtp_secure: Whether to wrap the SMTP connection in TLS from the start.
        smtp_user: SMTP authentication username.  Omit for unauthenticated relays.
        smtp_password: SMTP authentication password.  Omit for unauthenticated relays.
        smtp_from: Sender ``From`` address for outgoing alerts.
        notification_recipients_raw: Comma-separated list of recipient email
            addresses for DLQ alerts.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    port: int = 8007
    log_level: str = "INFO"
    google_application_credentials: str = ""

    gcp_project_id: str = ""
    firebase_project_id: str = "demo-elastic-resume-base"

    pubsub_topic_dlq: str = "dead-letter-queue"
    http_request_timeout: int = 300

    firestore_collection_notifications: str = "notifications"
    notification_ttl_days: int = 30

    # SMTP configuration (used by Hermes SmtpMessagingService)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_secure: bool = False
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    # Comma-separated recipient list — split into a list via the validator below
    notification_recipients_raw: str = Field(
        default="", alias="NOTIFICATION_RECIPIENTS"
    )

    @field_validator("notification_recipients_raw", mode="before")
    @classmethod
    def _coerce_none_to_empty(cls, v: object) -> object:
        """Treat None/missing values as an empty string."""
        return v if v is not None else ""

    @property
    def notification_recipients(self) -> list[str]:
        """Return the parsed list of notification recipient addresses.

        Returns:
            A list of stripped, non-empty email address strings.  Returns an
            empty list when ``NOTIFICATION_RECIPIENTS`` is not configured.
        """
        return [
            addr.strip()
            for addr in self.notification_recipients_raw.split(",")
            if addr.strip()
        ]

    @property
    def effective_project_id(self) -> str:
        """Return the effective GCP project ID for Firestore initialisation.

        Prefers ``gcp_project_id``; falls back to ``firebase_project_id``.
        """
        return self.gcp_project_id or self.firebase_project_id


load_config_yaml("dlq-notifier")

settings = Settings()
