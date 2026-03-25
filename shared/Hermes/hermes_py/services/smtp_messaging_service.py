"""SMTP-based implementation of IMessagingService."""

from __future__ import annotations

import logging
import smtplib
from collections.abc import Callable
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from hermes.interfaces.messaging_service import Message
from hermes.options import MessagingOptions

logger = logging.getLogger(__name__)

_SmtpFactory = Callable[[], smtplib.SMTP]


class SmtpMessagingService:
    """SMTP-based implementation of :class:`~hermes.interfaces.messaging_service.IMessagingService`.

    Uses Python's built-in :mod:`smtplib` module as the transport layer.  All
    connection details and credentials are supplied via
    :class:`~hermes.options.MessagingOptions` at construction time — no values
    are hardcoded or read from the environment here; callers are responsible
    for sourcing configuration (e.g. from ``config.yaml``).

    Example:
        >>> from hermes.options import MessagingOptions
        >>> from hermes.services.smtp_messaging_service import SmtpMessagingService
        >>> service = SmtpMessagingService(
        ...     MessagingOptions(
        ...         host="smtp.example.com",
        ...         port=587,
        ...         user="alerts@example.com",
        ...         password="secret",
        ...         from_address="noreply@example.com",
        ...     )
        ... )
        >>> service.send(
        ...     Message(to="ops@example.com", subject="Job failed", body="Details here.")
        ... )
    """

    def __init__(
        self,
        options: MessagingOptions,
        smtp_factory: _SmtpFactory | None = None,
    ) -> None:
        """Initialise the SMTP messaging service.

        Args:
            options: SMTP connection and authentication configuration.
            smtp_factory: Optional callable that returns a ready-to-use
                :class:`smtplib.SMTP` instance.  Provide this in tests to
                inject a mock transport and avoid real SMTP calls.  When
                ``None`` (the default), a real connection is created using
                :attr:`options`.
        """
        self._options = options
        self._smtp_factory = smtp_factory

    def _create_smtp_connection(self) -> smtplib.SMTP:
        """Create and return a connected SMTP session.

        Returns:
            An authenticated (if credentials are configured) SMTP session
            ready for sending mail.

        Raises:
            smtplib.SMTPException: If the connection or login fails.
        """
        if self._options.secure:
            smtp: smtplib.SMTP = smtplib.SMTP_SSL(self._options.host, self._options.port)
        else:
            smtp = smtplib.SMTP(self._options.host, self._options.port)
            smtp.ehlo()
            try:
                smtp.starttls()
                smtp.ehlo()
            except smtplib.SMTPNotSupportedError:
                pass  # Server does not support STARTTLS — continue with plain

        if self._options.user and self._options.password:
            smtp.login(self._options.user, self._options.password)

        return smtp

    def send(self, message: Message) -> None:
        """Send a message via SMTP.

        Establishes a fresh SMTP connection for each call (or uses the
        injected factory), delivers the message, then closes the connection.

        Args:
            message: The message to deliver.

        Raises:
            smtplib.SMTPException: If the SMTP server rejects the message or
                is unreachable.

        Example:
            >>> service.send(
            ...     Message(
            ...         to=["alice@example.com", "bob@example.com"],
            ...         subject="DLQ alert",
            ...         body="<p>A job failed.</p>",
            ...         is_html=True,
            ...     )
            ... )
        """
        recipients = message.to if isinstance(message.to, list) else [message.to]
        to_header = ", ".join(recipients)

        if message.is_html:
            mime_msg: MIMEMultipart | MIMEText = MIMEMultipart("alternative")
            mime_msg["Subject"] = message.subject
            mime_msg["From"] = self._options.from_address
            mime_msg["To"] = to_header
            mime_msg.attach(MIMEText(message.body, "html"))
        else:
            mime_msg = MIMEText(message.body, "plain")
            mime_msg["Subject"] = message.subject
            mime_msg["From"] = self._options.from_address
            mime_msg["To"] = to_header

        smtp = (
            self._smtp_factory()
            if self._smtp_factory is not None
            else self._create_smtp_connection()
        )
        try:
            smtp.sendmail(self._options.from_address, recipients, mime_msg.as_string())
            logger.debug(
                "Message sent via SMTP to %d recipient(s).",
                len(recipients),
            )
        finally:
            try:
                smtp.quit()
            except smtplib.SMTPException:
                pass  # Ignore quit errors; message was already sent
