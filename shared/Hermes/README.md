# Hermes

Hermes is the **sole messaging abstraction layer** for Elastic Resume Base microservices. It decouples services from any specific messaging transport (SMTP, SendGrid, Slack, etc.) so that swapping providers requires only a Hermes configuration change — no consuming service needs to be refactored.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Messaging transport initialisation | ✅ Hermes (`initializeMessaging`, `initializeMessagingFromEnv`) |
| Sending notifications | ✅ Hermes (`IMessagingService.send`) |
| SMTP transport implementation | ✅ Hermes (`SmtpMessagingService`) |
| Message content / business logic | ❌ Consuming service |
| Persistence | ❌ Synapse |

---

## Installation

To install Hermes use a relative path to the package since it is not published to npm. From the root of your project, run:

```bash
npm install ../shared/Hermes
```

If Hermes hasn't been built yet, build it first:

```bash
cd shared/Hermes
npm install
npm run build
```

Or build all shared packages at once from the monorepo root:

```bash
./build_shared.sh
```

---

## Configuration

Hermes reads SMTP settings from `config.yaml` (which are merged into `process.env` at service startup). Add the following keys to your service's section — or to `shared` to make them available to all services:

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

| Variable        | Required | Description                                           |
|-----------------|----------|-------------------------------------------------------|
| `SMTP_HOST`     | ✅       | SMTP server hostname                                  |
| `SMTP_PORT`     | ✅       | SMTP server port (e.g. `587`, `465`, `25`)            |
| `SMTP_SECURE`   | ❌       | `"true"` to wrap in TLS from the start (default: `"false"`) |
| `SMTP_USER`     | ❌       | SMTP username — omit for unauthenticated relays       |
| `SMTP_PASSWORD` | ❌       | SMTP password — omit for unauthenticated relays       |
| `SMTP_FROM`     | ✅       | Sender `From` address used for all outbound messages  |

---

## Quick Start

```typescript
import { initializeMessagingFromEnv, getMessagingService } from '@elastic-resume-base/hermes';

// 1. Initialise once at application startup (after config.yaml has been loaded).
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

## Modules

### Messaging initialisation (`messaging.ts`)

This is the **entry point** every consuming service must call before using `getMessagingService`.

#### `initializeMessaging(options: MessagingOptions): void`

Initialises Hermes with explicit configuration. Idempotent — the first call wins.

```typescript
import { initializeMessaging } from '@elastic-resume-base/hermes';

initializeMessaging({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.SMTP_FROM ?? 'noreply@example.com',
});
```

#### `initializeMessagingFromEnv(): void`

Initialises Hermes by reading all required settings directly from `process.env`.  Throws a `ZodError` if any required variable is missing or invalid. Idempotent.

```typescript
import { initializeMessagingFromEnv } from '@elastic-resume-base/hermes';

initializeMessagingFromEnv();
```

#### `MessagingOptions`

| Field      | Type      | Required | Description                                              |
|------------|-----------|----------|----------------------------------------------------------|
| `host`     | `string`  | ✅       | SMTP server hostname                                     |
| `port`     | `number`  | ✅       | SMTP server port                                         |
| `secure`   | `boolean` | ❌       | TLS from the start (default: `false`)                    |
| `user`     | `string`  | ❌       | SMTP username — omit for unauthenticated relays          |
| `password` | `string`  | ❌       | SMTP password — omit for unauthenticated relays          |
| `from`     | `string`  | ✅       | Sender `From` address for all outbound messages          |

---

### `IMessagingService` interface (`interfaces/messaging-service.ts`)

Services should depend on this interface — not on any concrete implementation — so that the transport can be swapped without touching business logic.

```typescript
interface IMessagingService {
  send(message: Message): Promise<void>;
}
```

#### `Message`

| Field     | Type                  | Required | Description                                      |
|-----------|-----------------------|----------|--------------------------------------------------|
| `to`      | `string \| string[]`  | ✅       | Recipient address(es)                            |
| `subject` | `string`              | ✅       | Subject line or title                            |
| `body`    | `string`              | ✅       | Message body                                     |
| `isHtml`  | `boolean`             | ❌       | Treat `body` as HTML (default: `false`)          |

---

### SMTP implementation (`services/smtp-messaging-service.ts`)

`SmtpMessagingService` is the built-in SMTP transport. It wraps **nodemailer** and accepts a `MessagingOptions` object at construction time.

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

You can inject a custom `Transporter` as the second constructor argument to mock SMTP in tests:

```typescript
import nodemailer from 'nodemailer';
import { SmtpMessagingService } from '@elastic-resume-base/hermes';

const mockTransporter = { sendMail: jest.fn().mockResolvedValue({}) };
const service = new SmtpMessagingService(options, mockTransporter as never);
```

---

## Implementing a New Transport

1. Create a class that implements `IMessagingService`.
2. Export it from `src/index.ts`.
3. Add unit tests in `tests/unit/<transport>.test.ts`.
4. Update this README.

```typescript
import type { IMessagingService, Message } from '@elastic-resume-base/hermes';

export class SlackMessagingService implements IMessagingService {
  constructor(private readonly _webhookUrl: string) {}

  async send(message: Message): Promise<void> {
    await fetch(this._webhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: `*${message.subject}*\n${message.body}` }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

---

## Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript to dist/
npm run lint       # Run ESLint
npm run typecheck  # Type-check without emitting
npm test           # Run unit tests
npm run test:coverage  # Run tests with coverage report
```

---

## License

Internal — Elastic Resume Base project.
