"""Unit tests for the Hermes messaging initialisation module.

All SMTP connections are mocked so no real server is required.
"""

from __future__ import annotations

import pytest

from hermes_py import (
    get_messaging_service,
    initialize_messaging,
    initialize_messaging_from_env,
)
from hermes_py.options import MessagingOptions
from hermes_py.services.smtp_messaging_service import SmtpMessagingService

# ---------------------------------------------------------------------------
# initialize_messaging
# ---------------------------------------------------------------------------


class TestInitializeMessaging:
    """Tests for initialize_messaging()."""

    def test_creates_smtp_messaging_service(self) -> None:
        """After initialization, get_messaging_service returns an SmtpMessagingService."""
        initialize_messaging(
            MessagingOptions(host="smtp.example.com", port=587, from_address="noreply@example.com")
        )
        service = get_messaging_service()
        assert isinstance(service, SmtpMessagingService)

    def test_is_idempotent(self) -> None:
        """A second call to initialize_messaging has no effect — first call wins."""
        initialize_messaging(
            MessagingOptions(host="first.example.com", port=25, from_address="a@example.com")
        )
        first_instance = get_messaging_service()

        initialize_messaging(
            MessagingOptions(host="second.example.com", port=25, from_address="b@example.com")
        )
        second_instance = get_messaging_service()

        assert first_instance is second_instance

    def test_host_and_port_forwarded_to_service(self) -> None:
        """MessagingOptions fields are passed through to the service."""
        initialize_messaging(
            MessagingOptions(
                host="smtp.test.com",
                port=465,
                secure=True,
                from_address="x@test.com",
            )
        )
        service = get_messaging_service()
        assert isinstance(service, SmtpMessagingService)
        assert service._options.host == "smtp.test.com"
        assert service._options.port == 465
        assert service._options.secure is True

    def test_user_and_password_forwarded_to_service(self) -> None:
        """Credentials are forwarded to the service options."""
        initialize_messaging(
            MessagingOptions(
                host="smtp.test.com",
                port=587,
                user="user@test.com",
                password="secret",
                from_address="noreply@test.com",
            )
        )
        service = get_messaging_service()
        assert isinstance(service, SmtpMessagingService)
        assert service._options.user == "user@test.com"
        assert service._options.password == "secret"

    def test_no_credentials_when_omitted(self) -> None:
        """user and password default to None when not supplied."""
        initialize_messaging(
            MessagingOptions(host="relay.test.com", port=25, from_address="noreply@test.com")
        )
        service = get_messaging_service()
        assert isinstance(service, SmtpMessagingService)
        assert service._options.user is None
        assert service._options.password is None


# ---------------------------------------------------------------------------
# initialize_messaging_from_env
# ---------------------------------------------------------------------------


class TestInitializeMessagingFromEnv:
    """Tests for initialize_messaging_from_env()."""

    def test_reads_smtp_host_port_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Required env vars are read and passed to the service."""
        monkeypatch.setenv("SMTP_HOST", "smtp.env-test.com")
        monkeypatch.setenv("SMTP_PORT", "2525")
        monkeypatch.setenv("SMTP_FROM", "env@example.com")

        initialize_messaging_from_env()

        service = get_messaging_service()
        assert isinstance(service, SmtpMessagingService)
        assert service._options.host == "smtp.env-test.com"
        assert service._options.port == 2525

    def test_coerces_smtp_port_string_to_int(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """SMTP_PORT is coerced from a string to an integer."""
        monkeypatch.setenv("SMTP_HOST", "localhost")
        monkeypatch.setenv("SMTP_PORT", "1025")
        monkeypatch.setenv("SMTP_FROM", "test@local")

        initialize_messaging_from_env()

        service = get_messaging_service()
        assert isinstance(service, SmtpMessagingService)
        assert isinstance(service._options.port, int)
        assert service._options.port == 1025

    def test_smtp_secure_true_when_env_is_true(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """SMTP_SECURE='true' sets secure=True on the service options."""
        monkeypatch.setenv("SMTP_HOST", "localhost")
        monkeypatch.setenv("SMTP_PORT", "465")
        monkeypatch.setenv("SMTP_SECURE", "true")
        monkeypatch.setenv("SMTP_FROM", "test@local")

        initialize_messaging_from_env()

        service = get_messaging_service()
        assert isinstance(service, SmtpMessagingService)
        assert service._options.secure is True

    def test_smtp_secure_false_when_env_absent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """secure defaults to False when SMTP_SECURE is not set."""
        monkeypatch.setenv("SMTP_HOST", "localhost")
        monkeypatch.setenv("SMTP_PORT", "587")
        monkeypatch.setenv("SMTP_FROM", "test@local")
        monkeypatch.delenv("SMTP_SECURE", raising=False)

        initialize_messaging_from_env()

        service = get_messaging_service()
        assert isinstance(service, SmtpMessagingService)
        assert service._options.secure is False

    def test_is_idempotent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A second call has no effect — the first service instance is preserved."""
        monkeypatch.setenv("SMTP_HOST", "localhost")
        monkeypatch.setenv("SMTP_PORT", "1025")
        monkeypatch.setenv("SMTP_FROM", "first@local")

        initialize_messaging_from_env()
        first_instance = get_messaging_service()

        initialize_messaging_from_env()
        second_instance = get_messaging_service()

        assert first_instance is second_instance

    def test_raises_when_smtp_host_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """ValidationError is raised when SMTP_HOST is absent."""
        monkeypatch.delenv("SMTP_HOST", raising=False)
        monkeypatch.setenv("SMTP_PORT", "587")
        monkeypatch.setenv("SMTP_FROM", "test@example.com")

        with pytest.raises(Exception):
            initialize_messaging_from_env()

    def test_raises_when_smtp_port_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """ValidationError is raised when SMTP_PORT is absent."""
        monkeypatch.setenv("SMTP_HOST", "localhost")
        monkeypatch.delenv("SMTP_PORT", raising=False)
        monkeypatch.setenv("SMTP_FROM", "test@example.com")

        with pytest.raises(Exception):
            initialize_messaging_from_env()

    def test_raises_when_smtp_from_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """ValidationError is raised when SMTP_FROM is absent."""
        monkeypatch.setenv("SMTP_HOST", "localhost")
        monkeypatch.setenv("SMTP_PORT", "587")
        monkeypatch.delenv("SMTP_FROM", raising=False)

        with pytest.raises(Exception):
            initialize_messaging_from_env()


# ---------------------------------------------------------------------------
# get_messaging_service
# ---------------------------------------------------------------------------


class TestGetMessagingService:
    """Tests for get_messaging_service()."""

    def test_raises_before_initialisation(self) -> None:
        """RuntimeError is raised when called before any init function."""
        with pytest.raises(RuntimeError, match="initialize_messaging"):
            get_messaging_service()

    def test_returns_same_singleton_on_repeated_calls(self) -> None:
        """Repeated calls to get_messaging_service return the same instance."""
        initialize_messaging(
            MessagingOptions(host="localhost", port=25, from_address="noreply@local")
        )
        assert get_messaging_service() is get_messaging_service()
