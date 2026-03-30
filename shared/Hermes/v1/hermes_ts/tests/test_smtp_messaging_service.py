"""Unit tests for SmtpMessagingService.

smtplib connections are fully mocked — no real SMTP server is required.
"""

from __future__ import annotations

import smtplib
from email import message_from_string
from unittest.mock import MagicMock, patch

import pytest

from hermes_py.interfaces.messaging_service import Message
from hermes_py.options import MessagingOptions
from hermes_py.services.smtp_messaging_service import SmtpMessagingService


def _make_options(**overrides: object) -> MessagingOptions:
    """Build a MessagingOptions with sensible defaults for testing."""
    defaults: dict[str, object] = {
        "host": "localhost",
        "port": 25,
        "from_address": "noreply@example.com",
    }
    defaults.update(overrides)
    return MessagingOptions(**defaults)  # type: ignore[arg-type]


def _mock_smtp() -> MagicMock:
    """Return a minimal smtplib.SMTP mock that records sendmail/quit calls."""
    mock = MagicMock(spec=smtplib.SMTP)
    mock.sendmail.return_value = {}
    return mock


# ---------------------------------------------------------------------------
# Constructor
# ---------------------------------------------------------------------------


class TestSmtpMessagingServiceConstructor:
    """Tests for SmtpMessagingService.__init__."""

    def test_stores_options(self) -> None:
        """Options are accessible via the _options attribute."""
        opts = _make_options(host="smtp.test.com", port=587, secure=True)
        service = SmtpMessagingService(opts)
        assert service._options is opts

    def test_uses_injected_factory_instead_of_creating_connection(self) -> None:
        """When a factory is provided, _create_smtp_connection is never called."""
        mock_smtp = _mock_smtp()
        service = SmtpMessagingService(_make_options(), smtp_factory=lambda: mock_smtp)

        with patch.object(service, "_create_smtp_connection") as mock_create:
            service.send(Message(to="a@example.com", subject="s", body="b"))

        mock_create.assert_not_called()
        mock_smtp.sendmail.assert_called_once()


# ---------------------------------------------------------------------------
# _create_smtp_connection
# ---------------------------------------------------------------------------


class TestCreateSmtpConnection:
    """Tests for SmtpMessagingService._create_smtp_connection."""

    def test_uses_smtp_ssl_when_secure_is_true(self) -> None:
        """SMTP_SSL is used when secure=True."""
        opts = _make_options(host="smtp.example.com", port=465, secure=True)
        service = SmtpMessagingService(opts)

        mock_ssl_instance = MagicMock()
        mock_ssl_instance.sendmail.return_value = {}

        with (
            patch(
                "hermes_py.services.smtp_messaging_service.smtplib.SMTP_SSL",
                return_value=mock_ssl_instance,
            ) as mock_ssl,
            patch("hermes_py.services.smtp_messaging_service.smtplib.SMTP") as mock_plain,
        ):
            service._create_smtp_connection()

        mock_ssl.assert_called_once_with("smtp.example.com", 465)
        mock_plain.assert_not_called()

    def test_uses_plain_smtp_when_secure_is_false(self) -> None:
        """Plain SMTP is used when secure=False."""
        opts = _make_options(host="smtp.example.com", port=587, secure=False)
        service = SmtpMessagingService(opts)

        mock_conn = MagicMock()
        with patch("hermes_py.services.smtp_messaging_service.smtplib.SMTP", return_value=mock_conn):
            service._create_smtp_connection()

        mock_conn.ehlo.assert_called()

    def test_calls_login_when_credentials_provided(self) -> None:
        """login() is called when both user and password are set."""
        opts = _make_options(
            host="smtp.example.com",
            port=587,
            user="user@test.com",
            password="secret",
        )
        service = SmtpMessagingService(opts)

        mock_conn = MagicMock()
        with patch("hermes_py.services.smtp_messaging_service.smtplib.SMTP", return_value=mock_conn):
            service._create_smtp_connection()

        mock_conn.login.assert_called_once_with("user@test.com", "secret")

    def test_does_not_call_login_when_no_credentials(self) -> None:
        """login() is NOT called when user/password are absent."""
        opts = _make_options()
        service = SmtpMessagingService(opts)

        mock_conn = MagicMock()
        with patch("hermes_py.services.smtp_messaging_service.smtplib.SMTP", return_value=mock_conn):
            service._create_smtp_connection()

        mock_conn.login.assert_not_called()


# ---------------------------------------------------------------------------
# send — plain text
# ---------------------------------------------------------------------------


class TestSendPlainText:
    """Tests for SmtpMessagingService.send with plain-text messages."""

    def test_sends_to_single_recipient(self) -> None:
        """sendmail is called with the correct from, to, and text body."""
        mock_smtp = _mock_smtp()
        service = SmtpMessagingService(
            _make_options(from_address="noreply@example.com"),
            smtp_factory=lambda: mock_smtp,
        )

        service.send(Message(to="alice@example.com", subject="Test subject", body="Hello, world!"))

        args = mock_smtp.sendmail.call_args
        assert args[0][0] == "noreply@example.com"
        assert args[0][1] == ["alice@example.com"]
        raw = args[0][2]
        parsed = message_from_string(raw)
        assert parsed["Subject"] == "Test subject"
        assert parsed["From"] == "noreply@example.com"
        assert parsed["To"] == "alice@example.com"
        assert parsed.get_content_type() == "text/plain"

    def test_sends_to_multiple_recipients(self) -> None:
        """Multiple recipients are passed as a list to sendmail."""
        mock_smtp = _mock_smtp()
        service = SmtpMessagingService(
            _make_options(from_address="noreply@example.com"),
            smtp_factory=lambda: mock_smtp,
        )

        service.send(
            Message(
                to=["alice@example.com", "bob@example.com"],
                subject="Multi",
                body="Body",
            )
        )

        args = mock_smtp.sendmail.call_args
        assert args[0][1] == ["alice@example.com", "bob@example.com"]
        parsed = message_from_string(args[0][2])
        assert parsed["To"] == "alice@example.com, bob@example.com"

    def test_quits_connection_after_send(self) -> None:
        """The SMTP connection is closed after a successful send."""
        mock_smtp = _mock_smtp()
        service = SmtpMessagingService(
            _make_options(),
            smtp_factory=lambda: mock_smtp,
        )

        service.send(Message(to="a@example.com", subject="s", body="b"))

        mock_smtp.quit.assert_called_once()


# ---------------------------------------------------------------------------
# send — HTML
# ---------------------------------------------------------------------------


class TestSendHtml:
    """Tests for SmtpMessagingService.send with HTML messages."""

    def test_html_body_uses_html_content_type(self) -> None:
        """When is_html=True, the MIME message uses text/html."""
        mock_smtp = _mock_smtp()
        service = SmtpMessagingService(
            _make_options(from_address="noreply@example.com"),
            smtp_factory=lambda: mock_smtp,
        )

        service.send(
            Message(
                to="alice@example.com",
                subject="HTML message",
                body="<p>Hello</p>",
                is_html=True,
            )
        )

        raw = mock_smtp.sendmail.call_args[0][2]
        parsed = message_from_string(raw)
        # multipart/alternative with a text/html part
        assert parsed.get_content_maintype() == "multipart"
        payloads = parsed.get_payload()
        assert isinstance(payloads, list)
        content_types = [p.get_content_type() for p in payloads]  # type: ignore[union-attr]
        assert "text/html" in content_types

    def test_plain_text_body_uses_text_plain_content_type(self) -> None:
        """When is_html=False, the MIME message uses text/plain."""
        mock_smtp = _mock_smtp()
        service = SmtpMessagingService(
            _make_options(),
            smtp_factory=lambda: mock_smtp,
        )

        service.send(
            Message(
                to="alice@example.com",
                subject="Plain",
                body="Hello",
                is_html=False,
            )
        )

        raw = mock_smtp.sendmail.call_args[0][2]
        parsed = message_from_string(raw)
        assert parsed.get_content_type() == "text/plain"


# ---------------------------------------------------------------------------
# send — error handling
# ---------------------------------------------------------------------------


class TestSendErrorHandling:
    """Tests for error propagation in SmtpMessagingService.send."""

    def test_propagates_smtp_exception_from_sendmail(self) -> None:
        """SMTPException raised by sendmail is propagated to the caller."""
        mock_smtp = _mock_smtp()
        mock_smtp.sendmail.side_effect = smtplib.SMTPException("Connection refused")
        service = SmtpMessagingService(
            _make_options(),
            smtp_factory=lambda: mock_smtp,
        )

        with pytest.raises(smtplib.SMTPException, match="Connection refused"):
            service.send(Message(to="a@example.com", subject="s", body="b"))

    def test_quits_connection_even_when_sendmail_raises(self) -> None:
        """The SMTP connection is closed even when sendmail throws."""
        mock_smtp = _mock_smtp()
        mock_smtp.sendmail.side_effect = smtplib.SMTPException("Rejected")
        service = SmtpMessagingService(
            _make_options(),
            smtp_factory=lambda: mock_smtp,
        )

        with pytest.raises(smtplib.SMTPException):
            service.send(Message(to="a@example.com", subject="s", body="b"))

        mock_smtp.quit.assert_called_once()

    def test_quit_error_does_not_mask_send_success(self) -> None:
        """If quit() raises, no exception is surfaced (message was already sent)."""
        mock_smtp = _mock_smtp()
        mock_smtp.quit.side_effect = smtplib.SMTPException("already closed")
        service = SmtpMessagingService(
            _make_options(),
            smtp_factory=lambda: mock_smtp,
        )

        # Should not raise — quit errors are silently ignored.
        service.send(Message(to="a@example.com", subject="s", body="b"))
