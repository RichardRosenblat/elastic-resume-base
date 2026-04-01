"""ITokenVerifier protocol — the interface all token verifier implementations must satisfy.

Aegis Python is server-only: Python services are always server-side, so there is no
client-side counterpart.
"""

from __future__ import annotations

from typing import Any, Protocol


class DecodedToken(Protocol):
    """Minimal interface for a decoded Firebase ID token.

    Attributes:
        uid: The user's unique identifier.
        email: The user's email address, if available.
        name: The user's display name, if available.
        picture: URL of the user's profile picture, if available.
    """

    @property
    def uid(self) -> str: ...

    @property
    def email(self) -> str | None: ...

    @property
    def name(self) -> str | None: ...

    @property
    def picture(self) -> str | None: ...


class ITokenVerifier(Protocol):
    """Interface for token verification implementations.

    Implementations must provide a single ``verify_token`` coroutine that accepts
    a raw bearer token string and returns decoded token data.
    """

    async def verify_token(self, token: str) -> Any:
        """Verify *token* and return the decoded payload.

        Args:
            token: The raw JWT bearer token string (without the ``Bearer `` prefix).

        Returns:
            A decoded token object (provider-specific type).

        Raises:
            ValueError: If the token is invalid, expired, or cannot be verified.
        """
        ...
