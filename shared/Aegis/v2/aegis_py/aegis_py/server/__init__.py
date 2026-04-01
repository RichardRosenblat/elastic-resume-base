"""Aegis Python server subpackage — server-side authentication."""

from aegis_py.server.auth import (
    AuthOptions,
    initialize_auth,
    terminate_auth,
    get_token_verifier,
    _set_token_verifier,
    _reset_token_verifier,
)
from aegis_py.server.firebase_token_verifier import FirebaseTokenVerifier, DecodedFirebaseToken
from aegis_py.server.interfaces.token_verifier import ITokenVerifier

__all__ = [
    "AuthOptions",
    "initialize_auth",
    "terminate_auth",
    "get_token_verifier",
    "_set_token_verifier",
    "_reset_token_verifier",
    "FirebaseTokenVerifier",
    "DecodedFirebaseToken",
    "ITokenVerifier",
]
