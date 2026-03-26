"""Application configuration for the document-reader service.

Settings are read from environment variables (or an optional ``.env`` file)
via :class:`pydantic_settings.BaseSettings`.  Instantiate :data:`settings`
once at module level; every other module imports that singleton.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the document-reader service.

    All fields can be overridden by the corresponding environment variable
    (case-insensitive).  A ``.env`` file in the working directory is loaded
    automatically when present.

    Attributes:
        gcp_project_id: Google Cloud project ID used by the Vision API.
            Defaults to an empty string (suitable for local dev without GCP).
        port: TCP port the service listens on.  Defaults to ``8004``.
        log_level: Root logging level string (e.g. ``"INFO"``, ``"DEBUG"``).
            Defaults to ``"INFO"``.
        max_file_size_mb: Maximum accepted upload size in megabytes.
            Files larger than this value are rejected with HTTP 422.
            Defaults to ``10``.
        rate_limit_per_minute: Maximum number of API requests accepted from a
            single client IP per minute.  Exceeding this triggers an HTTP 429
            response.  Defaults to ``60``.
        vision_api_rate_limit: Maximum number of Google Cloud Vision API calls
            allowed per minute across all requests.  Exceeding this raises a
            rate-limit error with a message directing users to contact support.
            Defaults to ``60``.
        google_application_credentials: Path to a GCP service-account JSON key
            file used for local development.  When non-empty the path is
            exported to the ``GOOGLE_APPLICATION_CREDENTIALS`` environment
            variable before any GCP client is created so that the Google Cloud
            libraries pick it up automatically.  Leave empty (the default) in
            production where Application Default Credentials are provided by
            the hosting environment (Cloud Run, GKE, etc.).
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    gcp_project_id: str = ""
    port: int = 8004
    log_level: str = "INFO"
    max_file_size_mb: int = 10
    rate_limit_per_minute: int = 60
    vision_api_rate_limit: int = 60
    google_application_credentials: str = ""


settings = Settings()
