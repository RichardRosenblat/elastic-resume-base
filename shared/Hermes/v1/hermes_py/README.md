# Hermes (Python)

Hermes is the **sole messaging abstraction layer** for Elastic Resume Base Python microservices. It decouples services from any specific messaging transport (SMTP, SendGrid, Slack, etc.) so that swapping providers requires only a configuration change — no consuming service needs to be refactored.

> **TypeScript version:** The typescript README can be found at [shared/Hermes/hermes_ts/README.md](../hermes_ts/README.md). Both versions share the same design and API principles, but the Python version is a separate implementation with its own codebase and tests.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Messaging transport initialisation | ✅ Hermes (`initialize_messaging`, `initialize_messaging_from_env`) |
| Sending notifications | ✅ Hermes (`IMessagingService.send`) |
| SMTP transport implementation | ✅ Hermes (`SmtpMessagingService`) |
| Message content / business logic | ❌ Consuming service |
| Persistence | ❌ Synapse |

---

## Installation

Hermes is an internal package — not published to PyPI. Install it via a local path reference.

From your service directory:

```bash
pip install -e ../shared/hermes
```

Or add the local path to your `requirements.txt`:

```
-e ../shared/hermes
```

---

## Configuration

Hermes reads SMTP settings from environment variables. When services use `config.yaml` (loaded at startup), add the following keys to your service's section — or to `shared` to make them available to all services:

```yaml
systems:
  shared:
    SMTP_HOST: "smtp.example.com"
    SMTP_PORT: "587"
    SMTP_SECURE: "false"        # set to "true" for SMTPS / port 465
    SMTP_USER: ""               # fill in locally — never commit real credentials
    SMTP_PASSWORD: ""           # fill in locally — never commit real credentials
    SMTP_FROM: "noreply@example.com"
```

| Variable        | Required | Description                                              |
|-----------------|----------|----------------------------------------------------------|
| `SMTP_HOST`     | ✅       | SMTP server hostname                                     |
| `SMTP_PORT`     | ✅       | SMTP server port (e.g. `587`, `465`, `25`)               |
| `SMTP_SECURE`   | ❌       | `"true"` to wrap in TLS from the start (default: `"false"`) |
| `SMTP_USER`     | ❌       | SMTP username — omit for unauthenticated relays          |
| `SMTP_PASSWORD` | ❌       | SMTP password — omit for unauthenticated relays          |
| `SMTP_FROM`     | ✅       | Sender `From` address for all outbound messages          |

---

## Quick Start

```python
from hermes import initialize_messaging_from_env, get_messaging_service
from hermes.interfaces import Message

# 1. Call once at application startup (after config.yaml has been loaded).
initialize_messaging_from_env()

# 2. Anywhere in your service, get the singleton and send a message.
messaging = get_messaging_service()
messaging.send(
    Message(
        to="ops@example.com",
        subject="DLQ job failed",
        body="The job resume-ingestion-001 exceeded its retry limit.",
    )
)
```

---

## API Reference

### `initialize_messaging(options: MessagingOptions) -> None`

Initialises Hermes with explicit configuration. Idempotent — the first call wins.

```python
from hermes import initialize_messaging
from hermes.options import MessagingOptions

initialize_messaging(
    MessagingOptions(
        host="smtp.example.com",
        port=587,
        secure=False,
        user="alerts@example.com",
        password="secret",
        from_address="noreply@example.com",
    )
)
```

### `initialize_messaging_from_env() -> None`

Initialises Hermes by reading all required settings directly from environment variables. Raises `pydantic_core.ValidationError` if any required variable is missing. Idempotent.

```python
from hermes import initialize_messaging_from_env

initialize_messaging_from_env()
```

### `get_messaging_service() -> IMessagingService`

Returns the singleton. Raises `RuntimeError` if called before any `initialize_messaging*` function.

```python
from hermes import get_messaging_service

messaging = get_messaging_service()
```

### `MessagingOptions`

| Field          | Type            | Required | Description                                       |
|----------------|-----------------|----------|---------------------------------------------------|
| `host`         | `str`           | ✅       | SMTP server hostname                              |
| `port`         | `int`           | ✅       | SMTP server port                                  |
| `from_address` | `str`           | ✅       | Sender `From` address for all outbound messages   |
| `secure`       | `bool`          | ❌       | TLS from the start (default: `False`)             |
| `user`         | `str \| None`   | ❌       | SMTP username — omit for unauthenticated relays   |
| `password`     | `str \| None`   | ❌       | SMTP password — omit for unauthenticated relays   |

### `IMessagingService` (Protocol)

Services should depend on this protocol — not on any concrete implementation.

```python
from hermes.interfaces import IMessagingService, Message

class AlertService:
    def __init__(self, messaging: IMessagingService) -> None:
        self._messaging = messaging

    def notify(self, text: str) -> None:
        self._messaging.send(
            Message(to="ops@example.com", subject="Alert", body=text)
        )
```

### `Message`

| Field      | Type                  | Required | Description                              |
|------------|-----------------------|----------|------------------------------------------|
| `to`       | `str \| list[str]`    | ✅       | Recipient address(es)                    |
| `subject`  | `str`                 | ✅       | Subject line or title                    |
| `body`     | `str`                 | ✅       | Message body                             |
| `is_html`  | `bool`                | ❌       | Treat `body` as HTML (default: `False`)  |

### `SmtpMessagingService`

The built-in SMTP transport using Python's `smtplib`. Pass an optional `smtp_factory` callable for test injection.

```python
from hermes.options import MessagingOptions
from hermes.services.smtp_messaging_service import SmtpMessagingService

service = SmtpMessagingService(
    MessagingOptions(
        host="smtp.example.com",
        port=587,
        user="alerts@example.com",
        password="secret",
        from_address="noreply@example.com",
    )
)

service.send(
    Message(
        to=["alice@example.com", "bob@example.com"],
        subject="Alert",
        body="<p>Something went wrong.</p>",
        is_html=True,
    )
)
```

Inject a mock SMTP connection in tests:

```python
from unittest.mock import MagicMock
import smtplib

mock_smtp = MagicMock(spec=smtplib.SMTP)
service = SmtpMessagingService(options, smtp_factory=lambda: mock_smtp)
```

---

## Implementing a Custom Transport

1. Create a class that implements `IMessagingService`.
2. Pass it directly to consuming services — or call `initialize_messaging()` with
   the appropriate `MessagingOptions` then replace the singleton via `_reset_messaging_for_testing`
   / re-initialise.

```python
from hermes.interfaces import IMessagingService, Message

class SlackMessagingService:
    def __init__(self, webhook_url: str) -> None:
        self._webhook_url = webhook_url

    def send(self, message: Message) -> None:
        import urllib.request, json
        payload = json.dumps({"text": f"*{message.subject}*\n{message.body}"}).encode()
        req = urllib.request.Request(
            self._webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req)
```

---

## Development

```bash
# Install production + dev dependencies
pip install -r requirements-dev.txt
pip install -e .

# Run linter
ruff check hermes/ tests/

# Format code
black hermes/ tests/

# Type-check
mypy hermes/

# Run tests
pytest tests/

# Run tests with coverage
pytest tests/ --cov --cov-report=term-missing
```

---

## License

Internal — Elastic Resume Base project.
