"""Authentication initialisation for Aegis Python.

Provides a singleton pattern for managing the Firebase Admin SDK app instance
and the active :class:`~aegis_py.interfaces.token_verifier.ITokenVerifier`.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import firebase_admin
from firebase_admin import credentials

from aegis_py.server.firebase_token_verifier import FirebaseTokenVerifier
from aegis_py.server.interfaces.token_verifier import ITokenVerifier


@dataclass
class AuthOptions:
    """Options for initialising the Firebase Admin SDK.

    Attributes:
        project_id: The Firebase / GCP project ID.  Defaults to the
            ``FIREBASE_PROJECT_ID`` environment variable.
        credential: Optional Firebase credentials object.  When ``None``,
            Application Default Credentials (ADC) are used automatically.
    """

    project_id: str | None = None
    credential: Any | None = None


_firebase_app: firebase_admin.App | None = None
_token_verifier: ITokenVerifier | None = None


def initialize_auth(options: AuthOptions | None = None) -> None:
    """Initialise the Firebase Admin SDK and the default token verifier.

    Call once at application startup before calling :func:`get_token_verifier`.

    Args:
        options: Optional :class:`AuthOptions`.  If ``None``, the project ID
            is read from the ``FIREBASE_PROJECT_ID`` environment variable and
            ADC are used for credentials.
    """
    global _firebase_app, _token_verifier  # noqa: PLW0603

    opts = options or AuthOptions()
    project_id = opts.project_id or os.environ.get("FIREBASE_PROJECT_ID", "")
    cred = opts.credential or credentials.ApplicationDefault()

    try:
        _firebase_app = firebase_admin.initialize_app(
            credential=cred,
            options={"projectId": project_id} if project_id else {},
        )
    except ValueError:
        # App already initialised — retrieve the existing default app.
        _firebase_app = firebase_admin.get_app()

    _token_verifier = FirebaseTokenVerifier(app=_firebase_app)


def terminate_auth() -> None:
    """Delete the Firebase Admin SDK app and reset the token verifier.

    Primarily intended for use in tests.
    """
    global _firebase_app, _token_verifier  # noqa: PLW0603

    if _firebase_app is not None:
        try:
            firebase_admin.delete_app(_firebase_app)
        except Exception:  # noqa: BLE001
            pass
        _firebase_app = None
    _token_verifier = None


def get_token_verifier() -> ITokenVerifier:
    """Return the active token verifier.

    Raises:
        RuntimeError: If :func:`initialize_auth` has not been called yet.
    """
    if _token_verifier is None:
        raise RuntimeError(
            "Aegis has not been initialised. "
            "Call initialize_auth() before get_token_verifier()."
        )
    return _token_verifier


def _set_token_verifier(verifier: ITokenVerifier) -> None:
    """Override the active token verifier — for testing only."""
    global _token_verifier  # noqa: PLW0603
    _token_verifier = verifier


def _reset_token_verifier() -> None:
    """Reset the token verifier to ``None`` — for testing only."""
    global _firebase_app, _token_verifier  # noqa: PLW0603
    _token_verifier = None
    _firebase_app = None
