"""Application configuration for the document-reader service.

Settings are read from environment variables and optional config files.

At import time, this module attempts to load monorepo YAML configuration
(``config.yaml`` or ``configs.yaml``), merge ``systems.shared`` with
``systems.document-reader``, and seed any missing environment variables.
Variables already present in the process environment always take precedence.
"""

import os
from pathlib import Path
from typing import Any, cast

from pydantic_settings import BaseSettings, SettingsConfigDict

try:
    import yaml
except ImportError:  # pragma: no cover - handled gracefully when dependency missing
    yaml = None


def _config_candidates() -> list[Path]:
    """Return candidate YAML config paths in search order."""
    cwd = Path.cwd()
    repo_root = Path(__file__).resolve().parents[2]

    candidates: list[Path] = []
    explicit = os.environ.get("CONFIG_FILE")
    if explicit:
        candidates.append(Path(explicit))

    candidates.extend(
        [
            cwd / "configs.yaml",
            cwd / "config.yaml",
            cwd.parent / "configs.yaml",
            cwd.parent / "config.yaml",
            repo_root / "configs.yaml",
            repo_root / "config.yaml",
        ]
    )

    # De-duplicate while preserving order.
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in candidates:
        if path not in seen:
            unique.append(path)
            seen.add(path)
    return unique


def _load_yaml_config_into_environ(service_name: str = "document-reader") -> None:
    """Seed os.environ from monorepo YAML config when available.

    Only scalar values are loaded and only when a key does not already exist
    in ``os.environ``.
    """
    if yaml is None:
        return

    config_path = next((path for path in _config_candidates() if path.exists()), None)
    if config_path is None:
        return

    try:
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except Exception:
        # Preserve current environment values when YAML is malformed/unreadable.
        return

    if not isinstance(raw, dict):
        return

    systems = cast("dict[str, Any]", raw).get("systems")
    if not isinstance(systems, dict):
        return

    systems_dict = cast("dict[str, Any]", systems)
    merged: dict[str, Any] = {}
    shared = systems_dict.get("shared")
    service = systems_dict.get(service_name)

    if isinstance(shared, dict):
        merged.update(cast("dict[str, Any]", shared))
    if isinstance(service, dict):
        merged.update(cast("dict[str, Any]", service))

    for key, value in merged.items():
        if value is None:
            continue
        if isinstance(value, (int, float, bool)):
            os.environ.setdefault(key, str(value))
        elif isinstance(value, str):
            os.environ.setdefault(key, value)


_load_yaml_config_into_environ()


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
        vision_api_timeout: Timeout in seconds for each Google Cloud Vision API
            call.  Defaults to ``30.0``.  Set higher when processing very large
            images or under heavy load; lower values help fail-fast on hung
            connections.
        http_request_timeout: Maximum seconds a single HTTP request to this
            service may take before a 504 Gateway Timeout is returned.
            Defaults to ``60``.  Health endpoints are excluded from this limit.
        vision_api_max_retries: Maximum number of retry attempts for transient
            Vision API errors (e.g. ``DeadlineExceeded``, ``ServiceUnavailable``).
            Retries use exponential backoff starting at ``vision_api_retry_delay``
            seconds.  Set to ``0`` to disable retries.  Defaults to ``3``.
        vision_api_retry_delay: Initial backoff delay in seconds before the
            first retry attempt.  Each subsequent attempt doubles the delay
            (exponential backoff).  Defaults to ``1.0``.
        vision_api_image_max_dimension: Maximum width or height in pixels for
            images sent to the Vision API.  Images larger than this are
            downscaled proportionally before the API call to reduce payload size
            and avoid ``504 Deadline Exceeded`` errors.  Set to ``0`` to
            disable downscaling.  Defaults to ``3000``.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    gcp_project_id: str = ""
    port: int = 8004
    log_level: str = "INFO"
    max_file_size_mb: int = 10
    rate_limit_per_minute: int = 60
    vision_api_rate_limit: int = 60
    google_application_credentials: str = ""
    vision_api_timeout: float = 30.0
    http_request_timeout: int = 60
    vision_api_max_retries: int = 3
    vision_api_retry_delay: float = 1.0
    vision_api_image_max_dimension: int = 3000


settings = Settings()
