"""Aegis Python v2 — server-side authentication abstraction.

Aegis Python provides a server-side token verification layer for Python
microservices, mirroring the TypeScript ``@elastic-resume-base/aegis/server``
module.

> **Browser/client note:** There is no client-side (browser) equivalent for
> Aegis Python — Python services are always server-side. For browser
> authentication in the React frontend, use
> ``@elastic-resume-base/aegis/client`` (TypeScript).

Quick start::

    from aegis_py import initialize_auth, get_token_verifier, RequestContext

    # Call once at application startup.
    initialize_auth()

    # In an auth middleware:
    verifier = get_token_verifier()
    decoded = await verifier.verify_token(bearer_token)
    ctx = RequestContext(
        uid=decoded.uid,
        email=decoded.email,
        name=decoded.name,
        picture=decoded.picture,
    )
"""

from aegis_py.auth import (
    AuthOptions,
    initialize_auth,
    terminate_auth,
    get_token_verifier,
    _set_token_verifier,
    _reset_token_verifier,
)
from aegis_py.firebase_token_verifier import FirebaseTokenVerifier, DecodedFirebaseToken
from aegis_py.models import RequestContext
from aegis_py.interfaces.token_verifier import ITokenVerifier

__all__ = [
    "AuthOptions",
    "initialize_auth",
    "terminate_auth",
    "get_token_verifier",
    "_set_token_verifier",
    "_reset_token_verifier",
    "FirebaseTokenVerifier",
    "DecodedFirebaseToken",
    "RequestContext",
    "ITokenVerifier",
]
