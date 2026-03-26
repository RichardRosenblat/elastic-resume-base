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
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    gcp_project_id: str = ""
    port: int = 8004
    log_level: str = "INFO"
    max_file_size_mb: int = 10


settings = Settings()
