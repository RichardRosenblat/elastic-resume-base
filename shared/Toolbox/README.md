# Toolbox

A shared library providing **cross-cutting utilities** for Elastic Resume Base microservices. Toolbox consolidates infrastructure-level code that would otherwise be duplicated across every service — structured logging, config loading, and Fastify middleware — into a single, well-tested package.

---

## Installation

To install Toolbox you must use a relative path to the package since it is not published to npm. From the service directory, run:

```bash
npm install ../shared/Toolbox
```

If Toolbox has not been built yet, build it first:

```bash
cd shared/Toolbox
npm install
npm run build
```

Or to build all shared packages at once from the monorepo root:

```bash
.\build_shared.bat
```

---

## Quick Start

```typescript
import { loadConfigYaml, createLogger, correlationIdHook, createRequestLoggerHook } from '@elastic-resume-base/toolbox';

// 1. Load config.yaml before reading process.env
loadConfigYaml('my-service');

// 2. Create a Pino logger for the service
const logger = createLogger({
  serviceName: 'my-service',
  logLevel: process.env['LOG_LEVEL'] ?? 'info',
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
});

// 3. Register Fastify middleware
app.addHook('onRequest', correlationIdHook);
app.addHook('onResponse', createRequestLoggerHook(logger));
```

---

## Modules

### `loadConfigYaml(serviceName: string): void`

Loads `config.yaml` and populates `process.env` with the merged contents of `systems.shared` and `systems.<serviceName>`.

**Behaviour:**
- Only sets keys that are **not** already present in `process.env` (shell/Docker/CI variables always take precedence).
- Returns silently if `config.yaml` cannot be found or parsed, allowing the service to fall back to existing `process.env` values.

**Search order for `config.yaml`:**
1. Path in the `CONFIG_FILE` environment variable (explicit override).
2. `config.yaml` in the current working directory.
3. `config.yaml` one directory above the current working directory.

```typescript
import { loadConfigYaml } from '@elastic-resume-base/toolbox';

// Call before importing config.ts so env vars are in place when Zod reads them
loadConfigYaml('my-service');
```

---

### `createLogger(options: CreateLoggerOptions): Logger`

Factory that returns a configured [Pino](https://getpino.io/) logger instance.

#### `CreateLoggerOptions`

| Property      | Type     | Required | Default         | Description                                          |
|---------------|----------|----------|-----------------|------------------------------------------------------|
| `serviceName` | `string` | ✅       | —               | Embedded as `service.name` in every log entry.       |
| `version`     | `string` | ❌       | `"1.0.0"`       | Embedded as `service.version` in every log entry.    |
| `logLevel`    | `string` | ❌       | `"info"`        | Pino log level (`"trace"`, `"debug"`, `"info"`, …).  |
| `nodeEnv`     | `string` | ❌       | `"development"` | When `"production"`, emits GCP-formatted JSON.       |

**Environments:**
- **development / test** — pretty-printed colourised output via `pino-pretty`.
- **production** — structured JSON formatted for Google Cloud Logging, using `@google-cloud/pino-logging-gcp-config`.

```typescript
import { createLogger } from '@elastic-resume-base/toolbox';
import { config } from '../config.js';

export const logger = createLogger({
  serviceName: 'my-service',
  version: '2.0.0',
  logLevel: config.logLevel,   // e.g. 'debug' in dev, 'info' in prod
  nodeEnv: config.nodeEnv,
});

logger.info({ userId: 'abc123' }, 'User authenticated');
logger.debug({ query: 'senior engineer' }, 'Search query received');
logger.warn({ uid }, 'Downstream service unavailable; using fallback');
logger.error({ err }, 'Unhandled exception');
```

---

### `correlationIdHook`

Fastify `onRequest` hook that attaches a correlation ID to every incoming request for distributed tracing.

**Resolution order:**
1. Value of the incoming `x-correlation-id` header (forwarded from an upstream service or client).
2. Freshly generated UUID v4 (when no header is present).

The resolved ID is stored on `request.correlationId` and echoed back via the `x-correlation-id` response header.

```typescript
import { correlationIdHook } from '@elastic-resume-base/toolbox';

app.addHook('onRequest', correlationIdHook);

// Later in a controller or service:
logger.info({ correlationId: request.correlationId }, 'Processing request');
```

---

### `createRequestLoggerHook(logger: Logger)`

Factory that returns a Fastify `onResponse` hook for structured HTTP request/response logging.

Each response emits a single `info`-level log entry containing:

| Field           | Description                                  |
|-----------------|----------------------------------------------|
| `method`        | HTTP verb (GET, POST, PATCH, …)              |
| `path`          | Request URL (path + query string)            |
| `statusCode`    | HTTP response status code                    |
| `durationMs`    | Elapsed time in milliseconds (rounded)       |
| `correlationId` | Trace ID from `correlationIdHook`            |

```typescript
import { createRequestLoggerHook } from '@elastic-resume-base/toolbox';
import { logger } from '../utils/logger.js';

app.addHook('onResponse', createRequestLoggerHook(logger));

// Sample log output:
// {"method":"GET","path":"/api/v1/users","statusCode":200,"durationMs":12,"correlationId":"…"}
```

---

## Typical Service Setup

The canonical way to wire up Toolbox in a Node.js microservice:

**`src/utils/logger.ts`**
```typescript
import { createLogger } from '@elastic-resume-base/toolbox';
import { config } from '../config.js';

export const logger = createLogger({
  serviceName: 'my-service',
  logLevel: config.logLevel,
  nodeEnv: config.nodeEnv,
});
```

**`src/app.ts`** (excerpt)
```typescript
import { correlationIdHook, createRequestLoggerHook } from '@elastic-resume-base/toolbox';
import { logger } from './utils/logger.js';

// In buildApp():
app.addHook('onRequest', correlationIdHook);
app.addHook('onResponse', createRequestLoggerHook(logger));
```

**`src/middleware/correlationId.ts`** (thin re-export)
```typescript
export { correlationIdHook } from '@elastic-resume-base/toolbox';
```

**`src/middleware/requestLogger.ts`** (thin wrapper)
```typescript
import { createRequestLoggerHook } from '@elastic-resume-base/toolbox';
import { logger } from '../utils/logger.js';

export const requestLoggerHook = createRequestLoggerHook(logger);
```

---

## Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript
npm run lint       # Lint source and tests
npm run typecheck  # Type-check without emitting
npm test           # Run unit tests
npm run test:coverage  # Run tests with coverage report
```

---

## License

Internal — Elastic Resume Base project.
