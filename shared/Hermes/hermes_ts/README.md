# Hermes (TypeScript)

Hermes is the sole messaging abstraction layer for Elastic Resume Base Node.js microservices. It decouples services from any specific messaging transport (SMTP, SendGrid, Slack, etc.) so that swapping providers requires only a configuration change; no consuming service needs to be refactored.

> Python version: the Python README can be found at [shared/Hermes/hermes_py/README.md](../hermes_py/README.md). Both versions share the same design and API principles, but the TypeScript version is a separate implementation with its own codebase and tests.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Messaging transport initialisation | Yes, Hermes (`initializeMessaging`, `initializeMessagingFromEnv`) |
| Sending notifications | Yes, Hermes (`IMessagingService.send`) |
| SMTP transport implementation | Yes, Hermes (`SmtpMessagingService`) |
| Message content / business logic | No, consuming service |
| Persistence | No, Synapse |

---

## Installation

Hermes is an internal package and is not published to npm. Install it via a local path reference.

From your service directory:

```bash
npm install ../shared/Hermes/hermes_ts
```

Or add the local path to your `package.json`:

```json
{
  "dependencies": {
    "@elastic-resume-base/hermes": "file:../shared/Hermes/hermes_ts"
  }
}
```

---

## Configuration

Hermes reads SMTP settings from environment variables. When services use `config.yaml` and load it into `process.env` at startup, add the following keys to your service's section, or to `shared` to make them available to all services:

```yaml
systems:
  shared:
    SMTP_HOST: "smtp.example.com"
    SMTP_PORT: "587"
    SMTP_SECURE: "false"        # set to "true" for SMTPS / port 465
    SMTP_USER: ""               # fill in locally; never commit real credentials
    SMTP_PASSWORD: ""           # fill in locally; never commit real credentials
    SMTP_FROM: "noreply@example.com"
```

| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | Yes | SMTP server port (for example `587`, `465`, `25`) |
| `SMTP_SECURE` | No | Set to `"true"` to wrap in TLS from the start; defaults to `false` |
| `SMTP_USER` | No | SMTP username; omit for unauthenticated relays |
| `SMTP_PASSWORD` | No | SMTP password; omit for unauthenticated relays |
| `SMTP_FROM` | Yes | Sender `From` address for all outbound messages |

---

## Quick Start

```typescript
import { getMessagingService, initializeMessagingFromEnv } from '@elastic-resume-base/hermes';

// 1. Call once at application startup, after config.yaml has been loaded.
initializeMessagingFromEnv();

// 2. Anywhere in your service, get the singleton and send a message.
const messaging = getMessagingService();

await messaging.send({
  to: 'ops@example.com',
  subject: 'DLQ job failed',
  body: 'The job resume-ingestion-001 exceeded its retry limit.',
});
```

---

## API Reference

### `initializeMessaging(options: MessagingOptions): void`

Initialises Hermes with explicit configuration. The function is idempotent; the first call wins.

```typescript
import { initializeMessaging } from '@elastic-resume-base/hermes';

initializeMessaging({
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  user: 'alerts@example.com',
  password: 'secret',
  from: 'noreply@example.com',
});
```

### `initializeMessagingFromEnv(): void`

Initialises Hermes by reading configuration from environment variables. Throws a `ZodError` if any required variable is missing or invalid. The function is idempotent.

```typescript
import { initializeMessagingFromEnv } from '@elastic-resume-base/hermes';

initializeMessagingFromEnv();
```

### `getMessagingService(): IMessagingService`

Returns the singleton messaging service. Throws an `Error` if called before `initializeMessaging()` or `initializeMessagingFromEnv()`.

```typescript
import { getMessagingService } from '@elastic-resume-base/hermes';

const messaging = getMessagingService();
```

### `MessagingOptions`

| Field | Type | Required | Description |
|---|---|---|---|
| `host` | `string` | Yes | SMTP server hostname |
| `port` | `number` | Yes | SMTP server port |
| `from` | `string` | Yes | Sender `From` address for all outbound messages |
| `secure` | `boolean` | No | TLS from the start; defaults to `false` |
| `user` | `string` | No | SMTP username; omit for unauthenticated relays |
| `password` | `string` | No | SMTP password; omit for unauthenticated relays |

### `IMessagingService`

Services should depend on this interface rather than on a concrete implementation.

```typescript
import type { IMessagingService } from '@elastic-resume-base/hermes';

class AlertService {
  constructor(private readonly messaging: IMessagingService) {}

  async notify(text: string): Promise<void> {
    await this.messaging.send({
      to: 'ops@example.com',
      subject: 'Alert',
      body: text,
    });
  }
}
```

### `Message`

| Field | Type | Required | Description |
|---|---|---|---|
| `to` | `string | string[]` | Yes | Recipient address or addresses |
| `subject` | `string` | Yes | Subject line or title |
| `body` | `string` | Yes | Message body |
| `isHtml` | `boolean` | No | Treat `body` as HTML; defaults to `false` |

### `SmtpMessagingService`

The built-in SMTP transport uses `nodemailer`. Pass an optional `Transporter` instance for test injection.

```typescript
import { SmtpMessagingService } from '@elastic-resume-base/hermes';

const service = new SmtpMessagingService({
  host: 'smtp.example.com',
  port: 587,
  user: 'alerts@example.com',
  password: 'secret',
  from: 'noreply@example.com',
});

await service.send({
  to: ['alice@example.com', 'bob@example.com'],
  subject: 'Alert',
  body: '<p>Something went wrong.</p>',
  isHtml: true,
});
```

Inject a mock transporter in tests:

```typescript
import { SmtpMessagingService } from '@elastic-resume-base/hermes';

const mockTransporter = {
  sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
};

const service = new SmtpMessagingService(
  {
    host: 'smtp.example.com',
    port: 587,
    from: 'noreply@example.com',
  },
  mockTransporter as never,
);
```

---

## Implementing a Custom Transport

1. Create a class that implements `IMessagingService`.
2. Pass it directly to consuming services, or keep using Hermes initialisation for SMTP and inject your custom transport where appropriate.

```typescript
import type { IMessagingService, Message } from '@elastic-resume-base/hermes';

class SlackMessagingService implements IMessagingService {
  constructor(private readonly webhookUrl: string) {}

  async send(message: Message): Promise<void> {
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*${message.subject}*\n${message.body}`,
      }),
    });
  }
}
```

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run linter
npm run lint

# Format code
npm run format

# Type-check
npm run typecheck
```

Test commands:

```bash
# macOS / Linux
npm run test
npm run test:coverage
```

```powershell
# Windows PowerShell
$env:NODE_OPTIONS='--experimental-vm-modules'
npx jest --runInBand --forceExit
npx jest --coverage
```

---

## License

Internal, Elastic Resume Base project.