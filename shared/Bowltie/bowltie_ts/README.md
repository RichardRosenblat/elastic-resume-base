# Bowltie (TypeScript)

A shared library providing **consistent API response formatting** utilities for Elastic Resume Base Node.js microservices. Bowltie wraps any payload — from persistence layers, downstream services, or business logic — into a uniform JSON envelope that is easy to consume across the application.

> **Python version:** The Python README can be found at [shared/Bowltie/bowltie_py/README.md](../bowltie_py/README.md). Both versions produce identical JSON envelopes, but the Python version is a separate implementation.

---

## Installation

Bowltie is an internal package and is not published to npm. Reference it via a local `file:` path in your service's `package.json`:

```json
{
  "dependencies": {
    "@elastic-resume-base/bowltie": "file:../shared/Bowltie/bowltie_ts"
  }
}
```

Then run:

```bash
npm install
```

If Bowltie has not been built yet, build it first from the monorepo root:

```bash
cd shared/Bowltie/bowltie_ts
npm install
npm run build
```

Or build all shared packages at once from the root:

```bash
.\build_shared.bat
```

---

## Quick Start

```typescript
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';

// Success — wrap any data in the standard envelope
res.status(200).json(formatSuccess(user, req.headers['x-request-id']));
// → { success: true, data: { uid: '...', email: '...' }, meta: { correlationId, timestamp } }

// Error — produce a machine-readable + human-readable error envelope
res.status(404).json(formatError('NOT_FOUND', 'User not found', req.headers['x-request-id']));
// → { success: false, error: { code: 'NOT_FOUND', message: 'User not found' }, meta: { correlationId, timestamp } }
```

---

## API Reference

### `formatSuccess<T>(data: T, correlationId?: string): SuccessResponse<T>`

Wraps `data` in a standard success envelope.

| Parameter      | Type      | Required | Description                                        |
|----------------|-----------|----------|----------------------------------------------------|
| `data`         | `T`       | ✅       | The response payload.                              |
| `correlationId`| `string`  | ❌       | Optional request/trace ID for distributed tracing. |

**Returns:** `SuccessResponse<T>` — `{ success: true, data, meta: { correlationId?, timestamp } }`

---

### `formatError(code: string, message: string, correlationId?: string): ErrorResponse`

Produces a standard error envelope.

| Parameter      | Type     | Required | Description                                             |
|----------------|----------|----------|---------------------------------------------------------|
| `code`         | `string` | ✅       | Machine-readable error code (e.g. `'NOT_FOUND'`).      |
| `message`      | `string` | ✅       | Human-readable description of the error.               |
| `correlationId`| `string` | ❌       | Optional request/trace ID for distributed tracing.     |

**Returns:** `ErrorResponse` — `{ success: false, error: { code, message }, meta: { correlationId?, timestamp } }`

---

## Types

```typescript
interface ResponseMeta {
  correlationId?: string;  // Correlation / request ID for distributed tracing
  timestamp: string;       // ISO-8601 timestamp of response generation
}

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
  meta: ResponseMeta;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
```

---

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run lint         # Lint source and tests
npm run typecheck    # Type-check without emitting
npm test             # Run unit tests
npm run test:coverage  # Run tests with coverage report
```

---

## License

Internal — Elastic Resume Base project.
