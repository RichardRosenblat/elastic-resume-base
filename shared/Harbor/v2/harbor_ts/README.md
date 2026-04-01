# @elastic-resume-base/harbor (v2)

**HarborClient** — Shared HTTP request abstraction for Elastic Resume Base microservices.

Version 2 introduces a strict **client/server module split**, ensuring that server-side
logic (Google Cloud IAM authentication) is never accidentally bundled into browser code.

---

## Module Split

| Import path | Environment | Purpose |
|---|---|---|
| `@elastic-resume-base/harbor/client` | Browser & Node.js | Basic HTTP client, no auth |
| `@elastic-resume-base/harbor/server` | Node.js only | Basic HTTP client + IAM-authenticated client |

> **Rule:** Frontend code imports from `./client`. Backend Node.js services import from
> `./server`. There is no root `.` export — the explicit sub-path is required.

---

## Client Module (`./client`)

### Quick Start

```typescript
import { createHarborClient, isHarborError } from '@elastic-resume-base/harbor/client';

const client = createHarborClient({
  baseURL: 'https://api.example.com',
  timeoutMs: 30_000,
});

try {
  const response = await client.get('/data');
} catch (err) {
  if (isHarborError(err)) {
    // Handle HTTP / network errors
  }
}
```

---

## Server Module (`./server`)

### Quick Start — basic HTTP client

```typescript
import { createHarborClient, isHarborError } from '@elastic-resume-base/harbor/server';

const client = createHarborClient({
  baseURL: config.documentReaderServiceUrl,
  timeoutMs: config.requestTimeoutMs,
});

const result = await client.post<DocumentReadResponse>('/read', payload);
```

### Quick Start — IAM-authenticated service-to-service client

```typescript
import { createIamHarborClient } from '@elastic-resume-base/harbor/server';

const client = createIamHarborClient({
  baseURL: config.usersApiServiceUrl,
  timeoutMs: config.requestTimeoutMs,
  audience: config.usersApiServiceUrl,
});

// Every request now carries an OIDC identity token automatically.
const response = await client.get('/api/v1/users');
```

---

## API Reference

### `createHarborClient(options)`

Creates a pre-configured `HarborClient` (an Axios instance) for communicating with a
downstream service.

| Option | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL for all requests made by this client. |
| `timeoutMs` | `number` (optional) | Request timeout in milliseconds. Omit to disable timeout. |
| `defaultHeaders` | `Record<string, string>` (optional) | Default headers attached to every request. |

### `createIamHarborClient(options)` *(server module only)*

Creates a `HarborClient` that automatically attaches a Google Cloud OIDC identity token
to every outgoing request for IAM-based service-to-service authentication.

Extends `HarborClientOptions` with:

| Option | Type | Description |
|---|---|---|
| `audience` | `string` | The IAM OIDC audience. For Cloud Run this is the service HTTPS URL. |

Authentication uses Application Default Credentials (ADC): on GCP the service account is
used automatically; locally, ADC falls back to `gcloud auth application-default login`.

### `isHarborError(err)`

Determines whether a caught error originated from a HarborClient request (Axios error).

```typescript
if (isHarborError(err)) {
  if (err.code === 'ECONNABORTED' || !err.response) {
    throw new UnavailableError('Service unavailable');
  }
  throw new DownstreamError('Unexpected response from service');
}
```

---

## Installation

Harbor is an internal package installed via a relative `file:` path:

```json
{
  "dependencies": {
    "@elastic-resume-base/harbor": "file:../../shared/Harbor/v2/harbor_ts"
  }
}
```

## Building

```bash
cd shared/Harbor/v2/harbor_ts
npm install
npm run build
```

## Testing

```bash
npm test
```

## Migration from v1

| Old import (v1) | New import (v2) |
|---|---|
| `from '@elastic-resume-base/harbor'` | `from '@elastic-resume-base/harbor/server'` (Node.js) |
| `from '@elastic-resume-base/harbor'` | `from '@elastic-resume-base/harbor/client'` (browser) |
