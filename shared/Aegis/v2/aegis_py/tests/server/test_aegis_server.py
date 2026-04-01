"""Unit tests for aegis_py v2 — authentication initialisation, token verification,
RequestContext, and FirebaseTokenVerifier."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from aegis_py import (
    AuthOptions,
    RequestContext,
    FirebaseTokenVerifier,
    DecodedFirebaseToken,
    get_token_verifier,
    initialize_auth,
    terminate_auth,
    _reset_token_verifier,
    _set_token_verifier,
)
from aegis_py.server.interfaces.token_verifier import ITokenVerifier


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_app() -> MagicMock:
    app = MagicMock()
    app.name = "[DEFAULT]"
    return app


# ---------------------------------------------------------------------------
# RequestContext
# ---------------------------------------------------------------------------


class TestRequestContext:
    def test_uid_only(self) -> None:
        ctx = RequestContext(uid="user-123")
        assert ctx.uid == "user-123"
        assert ctx.email is None
        assert ctx.name is None
        assert ctx.picture is None

    def test_all_fields(self) -> None:
        ctx = RequestContext(
            uid="user-456",
            email="user@example.com",
            name="Test User",
            picture="https://example.com/photo.jpg",
        )
        assert ctx.email == "user@example.com"
        assert ctx.name == "Test User"
        assert ctx.picture == "https://example.com/photo.jpg"

    def test_is_frozen(self) -> None:
        ctx = RequestContext(uid="user-789")
        with pytest.raises(Exception):
            ctx.uid = "other"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# DecodedFirebaseToken
# ---------------------------------------------------------------------------


class TestDecodedFirebaseToken:
    def test_from_dict_full(self) -> None:
        data = {
            "uid": "abc",
            "email": "a@b.com",
            "name": "Alice",
            "picture": "https://pic.url",
        }
        token = DecodedFirebaseToken.from_dict(data)
        assert token.uid == "abc"
        assert token.email == "a@b.com"
        assert token.name == "Alice"
        assert token.picture == "https://pic.url"

    def test_from_dict_uid_only(self) -> None:
        token = DecodedFirebaseToken.from_dict({"uid": "xyz"})
        assert token.uid == "xyz"
        assert token.email is None
        assert token.name is None
        assert token.picture is None


# ---------------------------------------------------------------------------
# FirebaseTokenVerifier
# ---------------------------------------------------------------------------


class TestFirebaseTokenVerifier:
    @pytest.mark.asyncio
    async def test_verify_token_returns_decoded(self) -> None:
        fake_decoded = {
            "uid": "user-1",
            "email": "user@example.com",
            "name": "User",
            "picture": None,
        }
        with patch("firebase_admin.auth.verify_id_token", return_value=fake_decoded):
            verifier = FirebaseTokenVerifier()
            result = await verifier.verify_token("fake-token")
        assert result.uid == "user-1"
        assert result.email == "user@example.com"

    @pytest.mark.asyncio
    async def test_verify_token_raises_value_error_on_invalid(self) -> None:
        import firebase_admin.auth as fb_auth

        with patch(
            "firebase_admin.auth.verify_id_token",
            side_effect=fb_auth.InvalidIdTokenError("bad token"),
        ):
            verifier = FirebaseTokenVerifier()
            with pytest.raises(ValueError, match="Invalid token"):
                await verifier.verify_token("bad-token")

    @pytest.mark.asyncio
    async def test_verify_token_raises_value_error_on_expired(self) -> None:
        import firebase_admin.auth as fb_auth

        with patch(
            "firebase_admin.auth.verify_id_token",
            side_effect=fb_auth.ExpiredIdTokenError("expired", None),
        ):
            verifier = FirebaseTokenVerifier()
            with pytest.raises(ValueError, match="Expired token"):
                await verifier.verify_token("expired-token")


# ---------------------------------------------------------------------------
# initialize_auth / get_token_verifier
# ---------------------------------------------------------------------------


class TestAuthInit:
    def setup_method(self) -> None:
        _reset_token_verifier()

    def teardown_method(self) -> None:
        _reset_token_verifier()

    def test_get_token_verifier_raises_before_init(self) -> None:
        with pytest.raises(RuntimeError, match="initialize_auth"):
            get_token_verifier()

    def test_initialize_auth_sets_verifier(self) -> None:
        mock_cred = MagicMock()
        mock_app = _make_mock_app()

        with (
            patch("firebase_admin.initialize_app", return_value=mock_app),
            patch("firebase_admin.credentials.ApplicationDefault", return_value=mock_cred),
        ):
            initialize_auth()
            verifier = get_token_verifier()
        assert isinstance(verifier, FirebaseTokenVerifier)

    def test_set_token_verifier_override(self) -> None:
        mock_verifier: ITokenVerifier = MagicMock(spec=ITokenVerifier)
        _set_token_verifier(mock_verifier)
        assert get_token_verifier() is mock_verifier

    def test_reset_token_verifier(self) -> None:
        mock_verifier: ITokenVerifier = MagicMock(spec=ITokenVerifier)
        _set_token_verifier(mock_verifier)
        _reset_token_verifier()
        with pytest.raises(RuntimeError):
            get_token_verifier()

    def test_terminate_auth_resets_verifier(self) -> None:
        mock_cred = MagicMock()
        mock_app = _make_mock_app()

        with (
            patch("firebase_admin.initialize_app", return_value=mock_app),
            patch("firebase_admin.credentials.ApplicationDefault", return_value=mock_cred),
            patch("firebase_admin.delete_app"),
        ):
            initialize_auth()
            terminate_auth()

        with pytest.raises(RuntimeError):
            get_token_verifier()

    def test_initialize_auth_uses_env_project_id(self) -> None:
        mock_cred = MagicMock()
        mock_app = _make_mock_app()

        with (
            patch("firebase_admin.initialize_app", return_value=mock_app) as mock_init,
            patch("firebase_admin.credentials.ApplicationDefault", return_value=mock_cred),
            patch.dict("os.environ", {"FIREBASE_PROJECT_ID": "test-project"}),
        ):
            initialize_auth()
            call_kwargs = mock_init.call_args[1]
            assert call_kwargs["options"]["projectId"] == "test-project"

    def test_initialize_auth_with_explicit_options(self) -> None:
        mock_cred = MagicMock()
        mock_app = _make_mock_app()
        opts = AuthOptions(project_id="my-project", credential=mock_cred)

        with patch("firebase_admin.initialize_app", return_value=mock_app) as mock_init:
            initialize_auth(opts)
            _, call_kwargs = mock_init.call_args
            assert call_kwargs["options"]["projectId"] == "my-project"
