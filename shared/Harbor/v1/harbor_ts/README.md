# @elastic-resume-base/harbor

**HarborClient** — Shared HTTP request abstraction for Elastic Resume Base microservices.

All outbound HTTP requests should be made through HarborClient instances to ensure consistent configuration, centralized error detection, and a stable foundation for future cross-cutting concerns (correlation ID forwarding, structured logging, retries, circuit breaking).

---

## Installation

Harbor is an internal package installed via a relative `file:` path in each service's `package.json`:

```json
{
  "dependencies": {
    "@elastic-resume-base/harbor": "file:../shared/Harbor/harbor_ts"
  }
}
```

---

## API Reference

### `createHarborClient(options)`

Creates a pre-configured `HarborClient` (an Axios instance) for communicating with a downstream service.

```typescript
import { createHarborClient } from '@elastic-resume-base/harbor';

const client = createHarborClient({
  baseURL: config.documentReaderServiceUrl,
  timeoutMs: config.requestTimeoutMs,
});

const response = await client.post<DocumentReadResponse>('/read', payload);
```

**Options:**

| Option | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL for all requests made by this client. |
| `timeoutMs` | `number` (optional) | Request timeout in milliseconds. Omit to disable timeout. |
| `defaultHeaders` | `Record<string, string>` (optional) | Default headers attached to every request. |

### `isHarborError(err)`

Determines whether a caught error originated from a HarborClient request. Use this guard in `catch` blocks before mapping errors to domain-specific error types.

```typescript
import { isHarborError } from '@elastic-resume-base/harbor';

try {
  await client.post('/endpoint', payload);
} catch (err) {
  if (isHarborError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
      throw new UnavailableError('Service unavailable');
    }
    if (err.response.status === 429) {
      throw new RateLimitError();
    }
    if (err.response.status >= 500) {
      throw new UnavailableError('Service error');
    }
    throw new DownstreamError('Unexpected response from service');
  }
  throw new DownstreamError('Unexpected error');
}
```

### Types

```typescript
// Configuration for a HarborClient instance
interface HarborClientOptions {
  baseURL: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
}

// A configured HTTP client (alias for AxiosInstance)
type HarborClient = AxiosInstance;

// Axios error type re-exported for use in type annotations
type HarborError = AxiosError;
```

---

## Usage in Services

### Integration with the Gateway

The Gateway wraps `createHarborClient` in `src/utils/httpClient.ts` to apply the application-level timeout from config:

```typescript
// gateway/src/utils/httpClient.ts
import { createHarborClient, type HarborClient } from '@elastic-resume-base/harbor';
import { config } from '../config.js';

export function createHttpClient(baseURL: string): HarborClient {
  return createHarborClient({
    baseURL,
    timeoutMs: config.requestTimeoutMs,
  });
}
```

Service clients then call `createHttpClient` for the service-specific base URL:

```typescript
// gateway/src/services/documentReaderClient.ts
import { isHarborError } from '@elastic-resume-base/harbor';
import { createHttpClient } from '../utils/httpClient.js';

const client = createHttpClient(config.documentReaderServiceUrl);

export async function readDocument(payload: DocumentReadRequest): Promise<DocumentReadResponse> {
  try {
    const response = await client.post<DocumentReadResponse>('/read', payload);
    return response.data;
  } catch (err) {
    if (isHarborError(err)) {
      // handle error ...
    }
    throw new DownstreamError('Unexpected error from DocumentReader service');
  }
}
```

---

## Building

```bash
cd shared/Harbor/harbor_ts
npm install
npm run build
```

## Testing

```bash
npm test
```
