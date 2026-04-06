"""Application configuration for the File Generator service.

Settings are read from environment variables and optional config files.

At import time, this module calls :func:`toolbox_py.load_config_yaml` to load
monorepo YAML configuration (``config.yaml`` or ``configs.yaml``), merge
``systems.shared`` with ``systems.file-generator``, and seed any missing
environment variables.  Variables already present in the process environment
always take precedence.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from toolbox_py import load_config_yaml


class Settings(BaseSettings):
    """Runtime settings for the File Generator service.

    All fields can be overridden by the corresponding environment variable
    (case-insensitive).  A ``.env`` file in the working directory is loaded
    automatically when present.

    Attributes:
        gcp_project_id: Google Cloud project ID used by Firestore and KMS.
            Defaults to an empty string (local dev without GCP).
        port: TCP port the service listens on.  Defaults to ``8003``.
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
        firestore_collection_translation_cache: Firestore collection name for
            cached translation results.  Defaults to ``"translation-cache"``.
        drive_template_file_id: Google Drive file ID for the ``.docx`` Jinja2
            resume template.  Required in production; may be left empty for
            local development when a local template path is provided instead.
        local_template_path: Path to a local ``.docx`` template file used in
            development when ``drive_template_file_id`` is not set.
        decrypt_kms_key_name: Fully-qualified Cloud KMS key name used to decrypt PII
            fields (e.g.
            ``projects/my-proj/locations/global/keyRings/my-ring/cryptoKeys/my-key``).
            When empty, decryption is skipped and field values are returned
            as-is (for local development).
        translation_api_location: Google Cloud region for the Translation API.
            Defaults to ``"global"``.
        http_request_timeout: Maximum seconds a single HTTP request to this
            service may take before a 504 Gateway Timeout is returned.
            Defaults to ``300``.  Health endpoints are excluded from this limit.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    gcp_project_id: str = ""
    port: int = 8003
    log_level: str = "INFO"
    google_application_credentials: str = ""

    firestore_collection_resumes: str = "resumes"
    firestore_collection_translation_cache: str = "translation-cache"

    drive_template_file_id: str = ""
    local_template_path: str = ""

    decrypt_kms_key_name: str = ""
    translation_api_location: str = "global"

    http_request_timeout: int = 300


load_config_yaml("file-generator")

settings = Settings()
