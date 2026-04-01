"""Data models shared across Aegis Python.

Provides :class:`RequestContext` — the canonical representation of an
authenticated server request derived from token verification.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RequestContext:
    """Canonical, provider-agnostic representation of an authenticated request.

    Populated from the decoded token after successful verification in auth
    middleware.  Services should work with :class:`RequestContext` rather than
    provider-specific token types.

    Attributes:
        uid: Unique identifier for the authenticated user.
        email: Email address associated with the account, if available.
        name: Display name of the user, if available.
        picture: URL of the user's profile picture, if available.
    """

    uid: str
    email: str | None = None
    name: str | None = None
    picture: str | None = None
