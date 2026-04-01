"""Firebase Admin SDK token verifier implementation.

Wraps ``firebase_admin.auth.verify_id_token`` in the :class:`ITokenVerifier`
interface so Aegis Python consumers are never directly coupled to
``firebase-admin``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import firebase_admin
from firebase_admin import auth as firebase_auth


@dataclass
class DecodedFirebaseToken:
    """Decoded Firebase ID token data exposed as typed attributes."""

    uid: str
    email: str | None
    name: str | None
    picture: str | None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DecodedFirebaseToken":
        return cls(
            uid=str(data["uid"]),
            email=data.get("email"),
            name=data.get("name"),
            picture=data.get("picture"),
        )


class FirebaseTokenVerifier:
    """Token verifier backed by the Firebase Admin SDK.

    This class must be used **after** :func:`~aegis_py.initialize_auth` has
    been called to initialise the Firebase Admin SDK.

    Args:
        app: Optional ``firebase_admin.App`` instance.  Uses the default app
            when *app* is ``None``.
    """

    def __init__(self, app: firebase_admin.App | None = None) -> None:
        self._app = app

    async def verify_token(self, token: str) -> DecodedFirebaseToken:
        """Verify a Firebase ID token and return the decoded token data.

        Args:
            token: Raw JWT bearer token (without the ``Bearer `` prefix).

        Returns:
            :class:`DecodedFirebaseToken` with ``uid``, ``email``, ``name``,
            and ``picture`` fields.

        Raises:
            ValueError: If the token is invalid, expired, or revoked.
        """
        try:
            decoded: dict[str, Any] = firebase_auth.verify_id_token(
                token, app=self._app
            )
        except firebase_auth.RevokedIdTokenError as exc:
            raise ValueError(f"Revoked token: {exc}") from exc
        except firebase_auth.UserDisabledError as exc:
            raise ValueError(f"User disabled: {exc}") from exc
        except firebase_auth.ExpiredIdTokenError as exc:
            raise ValueError(f"Expired token: {exc}") from exc
        except firebase_auth.InvalidIdTokenError as exc:
            raise ValueError(f"Invalid token: {exc}") from exc
        except Exception as exc:
            raise ValueError(f"Token verification failed: {exc}") from exc

        return DecodedFirebaseToken.from_dict(decoded)
