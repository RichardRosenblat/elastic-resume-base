"""Google API authentication helpers for Bugle v2.

Uses Application Default Credentials (ADC) by default — no
``GOOGLE_SERVICE_ACCOUNT_KEY`` environment variable is required.

ADC resolves credentials automatically from the environment:

- Local development: ``gcloud auth application-default login`` or
  ``GOOGLE_APPLICATION_CREDENTIALS`` pointing to a JSON key file.
- CI: ``GOOGLE_APPLICATION_CREDENTIALS`` pointing to a service-account key.
- Production (Cloud Run): the attached service-account identity.
"""

from __future__ import annotations

from collections.abc import Sequence

import google.auth
import google.auth.credentials

#: Required OAuth 2.0 scopes for Google Drive read access.
DRIVE_READONLY_SCOPES: tuple[str, ...] = (
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
)

#: Required OAuth 2.0 scopes for Google Sheets read access.
SHEETS_READONLY_SCOPES: tuple[str, ...] = (
    "https://www.googleapis.com/auth/spreadsheets.readonly",
)


def get_google_auth_client(
    scopes: Sequence[str] = DRIVE_READONLY_SCOPES,
    credentials: google.auth.credentials.Credentials | None = None,
) -> google.auth.credentials.Credentials:
    """Return a credentials object for accessing Google APIs.

    Uses **Application Default Credentials (ADC)** when no explicit
    credentials are supplied.  Pass *credentials* to override ADC (e.g. in
    tests or when the caller manages its own credential lifecycle).

    Args:
        scopes: OAuth 2.0 scopes to request.  Defaults to Drive read-only
            scopes.  Ignored when explicit *credentials* are provided.
        credentials: Optional pre-configured credentials object.  When
            ``None`` (the default), ADC is used via
            :func:`google.auth.default`.

    Returns:
        A :class:`google.auth.credentials.Credentials` instance ready to be
        passed to a Google API client.

    Raises:
        google.auth.exceptions.DefaultCredentialsError: If ADC cannot resolve
            credentials (e.g. no gcloud login, no key file configured, and not
            running on GCP).

    Example::

        from bugle_py import get_google_auth_client, SHEETS_READONLY_SCOPES

        # ADC (default) — no env var required
        credentials = get_google_auth_client(SHEETS_READONLY_SCOPES)
    """
    if credentials is not None:
        return credentials

    creds, _ = google.auth.default(scopes=list(scopes))
    return creds
