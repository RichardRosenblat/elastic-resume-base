"""Google API authentication helpers for Bugle.

Mirrors ``shared/Bugle/v1/bugle_ts/src/auth.ts`` — credentials are loaded
exclusively from the ``GOOGLE_SERVICE_ACCOUNT_KEY`` environment variable so
that no credential files need to be mounted in containers.
"""

from __future__ import annotations

import base64
import json
import os

from google.oauth2 import service_account  # type: ignore[import-untyped]

#: Required OAuth 2.0 scopes for Google Drive read access.
DRIVE_READONLY_SCOPES: tuple[str, ...] = (
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
)

#: Required OAuth 2.0 scopes for Google Sheets read access.
SHEETS_READONLY_SCOPES: tuple[str, ...] = (
    "https://www.googleapis.com/auth/spreadsheets.readonly",
)


def _parse_service_account_key() -> dict[str, object]:
    """Parse the raw service-account key material from the environment.

    The key may be provided as:

    - A raw JSON string.
    - A Base64-encoded JSON string (useful for container environment variables).

    Returns:
        The parsed service account credentials dictionary.

    Raises:
        EnvironmentError: If ``GOOGLE_SERVICE_ACCOUNT_KEY`` is missing.
        ValueError: If the value cannot be parsed as a JSON object.
    """
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY", "").strip()
    if not raw:
        raise EnvironmentError(
            "GOOGLE_SERVICE_ACCOUNT_KEY environment variable is required but not set."
        )

    # Attempt Base64 decode; fall back to treating the value as plain JSON.
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        if decoded.lstrip().startswith("{"):
            raw = decoded
    except Exception:
        pass  # Not Base64 — use raw value as-is.

    try:
        return dict(json.loads(raw))  # type: ignore[arg-type]
    except json.JSONDecodeError as exc:
        raise ValueError(
            "Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: value must be a valid JSON object "
            "(raw or Base64-encoded)."
        ) from exc


def get_google_auth_client(
    scopes: tuple[str, ...] | list[str] = DRIVE_READONLY_SCOPES,
) -> service_account.Credentials:
    """Create a service-account credentials object authenticated for *scopes*.

    Credentials are loaded exclusively from the ``GOOGLE_SERVICE_ACCOUNT_KEY``
    environment variable — no credential files are read from disk.

    Args:
        scopes: OAuth 2.0 scopes to request.  Defaults to Drive read-only scopes.

    Returns:
        A :class:`google.oauth2.service_account.Credentials` instance ready to
        be passed to a Google API client.

    Raises:
        EnvironmentError: If ``GOOGLE_SERVICE_ACCOUNT_KEY`` is not set.
        ValueError: If the key cannot be parsed.

    Example::

        from bugle_py import get_google_auth_client, SHEETS_READONLY_SCOPES

        credentials = get_google_auth_client(SHEETS_READONLY_SCOPES)
    """
    key_data = _parse_service_account_key()
    return service_account.Credentials.from_service_account_info(
        key_data, scopes=list(scopes)
    )
