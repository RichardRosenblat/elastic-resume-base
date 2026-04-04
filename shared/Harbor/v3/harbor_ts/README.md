# @elastic-resume-base/harbor (v3)

**HarborClient** — Shared HTTP request abstraction (object-oriented interface) for
Elastic Resume Base microservices.

Version 3 transitions from the procedural factory-function interface of v1/v2 to a
fully **object-oriented class-based interface**.  Clients are now proper classes that
can be instantiated, extended, and injected via constructors — making every layer of
the stack independently testable and mockable.

---

## Module Split

| Import path | Environment | Purpose |
|---|---|---|
| `@elastic-resume-base/harbor/client` | Browser & Node.js | `HarborClient`, `HarborManager`, `GatewayServiceClient` |
| `@elastic-resume-base/harbor/server` | Node.js only | All of `./client` + `IamHarborClient`, `ServerHarborClient`, `UsersServiceClient`, `DocumentReaderServiceClient` |

> **Rule:** Frontend code imports from `./client`. Backend Node.js services import from
> `./server`. There is no root `.` export — the explicit sub-path is required.

---

## Client Module (`./client`)

### Quick Start — basic client

```typescript
import { HarborClient, isHarborError } from '@elastic-resume-base/harbor/client';

const client = new HarborClient({
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

### Quick Start — HarborManager (multiple clients)

```typescript
import { HarborManager } from '@elastic-resume-base/harbor/client';

const manager = new HarborManager();

// Register clients during startup:
manager.registerClient('users', { baseURL: 'http://users-api:8005', timeoutMs: 10_000 });
manager.registerClient('search', { baseURL: 'http://search:8002', timeoutMs: 5_000 });

// Retrieve anywhere:
const usersClient = manager.getClient('users');
```

### Quick Start — GatewayServiceClient

```typescript
import { HarborClient, GatewayServiceClient } from '@elastic-resume-base/harbor/client';

const harbor = new HarborClient({ baseURL: 'https://gateway.example.com' });
const gateway = new GatewayServiceClient(harbor);

const response = await gateway.get('/api/v1/resumes');
```

---

## Server Module (`./server`)

### Quick Start — environment-aware client (recommended)

```typescript
import { ServerHarborClient } from '@elastic-resume-base/harbor/server';

// Uses plain HarborClient in development, IamHarborClient in production.
const client = new ServerHarborClient({ baseURL: config.usersApiServiceUrl });
const response = await client.get('/api/v1/users');
```

### Quick Start — IAM-authenticated client

```typescript
import { IamHarborClient } from '@elastic-resume-base/harbor/server';

const client = new IamHarborClient({
  baseURL: config.usersApiServiceUrl,
  audience: config.usersApiServiceUrl,
});

const response = await client.get('/api/v1/users');
```

### Quick Start — service clients with injection

```typescript
import {
  ServerHarborClient,
  UsersServiceClient,
  DocumentReaderServiceClient,
} from '@elastic-resume-base/harbor/server';

// Create Harbor clients:
const usersHarbor = new ServerHarborClient({ baseURL: config.usersApiUrl });
const docHarbor = new ServerHarborClient({ baseURL: config.documentReaderUrl });

// Inject into service clients:
const users = new UsersServiceClient(usersHarbor);
const docReader = new DocumentReaderServiceClient(docHarbor);

// Use:
const response = await users.get('/api/v1/users');
const doc = await docReader.post('/read', payload);
```

### Testing with mocks

Because every service client accepts `IHarborClient` via injection, you can swap in a
mock without any additional test setup:

```typescript
import type { IHarborClient } from '@elastic-resume-base/harbor/server';
import { UsersServiceClient } from '@elastic-resume-base/harbor/server';

const mockHarbor: IHarborClient = {
  get: jest.fn().mockResolvedValue({ data: [{ id: 'u1' }], status: 200 }),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  request: jest.fn(),
  axiosInstance: {} as IHarborClient['axiosInstance'],
};

const users = new UsersServiceClient(mockHarbor);
const result = await users.get('/api/v1/users');
expect(result.data).toHaveLength(1);
```

---

## API Reference

### `HarborClient` (class)

A configurable HTTP client wrapping Axios.

**Constructor:** `new HarborClient(options: HarborClientOptions)`

| Option | Type | Description |
|---|---|---|
| `baseURL` | `string` | Base URL for all requests. |
| `timeoutMs` | `number` (optional) | Request timeout in milliseconds. |
| `defaultHeaders` | `Record<string, string>` (optional) | Headers attached to every request. |

**Methods:** `get`, `post`, `put`, `patch`, `delete`, `request`
**Property:** `axiosInstance` — exposes the underlying Axios instance for interceptor access.

---

### `IamHarborClient` (class) *(server only)*

Extends `HarborClient` and automatically attaches a Google Cloud OIDC identity token
to every request using Application Default Credentials (ADC).

**Constructor:** `new IamHarborClient(options: IamHarborClientOptions)`

Extends `HarborClientOptions` with:

| Option | Type | Description |
|---|---|---|
| `audience` | `string` | The IAM OIDC audience (typically the service HTTPS URL). |

---

### `ServerHarborClient` (class) *(server only)*

Extends `HarborClient`. In development (default), plain HTTP; in production
(`NODE_ENV === "production"`), IAM-authenticated.

**Constructor:** `new ServerHarborClient(options: ServerHarborClientOptions)`

Extends `HarborClientOptions` with:

| Option | Type | Description |
|---|---|---|
| `audience` | `string` (optional) | IAM OIDC audience used in production. Defaults to `baseURL`. |

---

### `HarborManager` (class)

Registry for managing multiple named `HarborClient` instances.

**Methods:**
- `registerClient(key, options)` — Register (or replace) a client.
- `getClient(key)` — Retrieve a registered client.
- `hasClient(key)` — Check if a client is registered.
- `unregisterClient(key)` — Remove a client.
- `clear()` — Remove all clients.
- `registeredKeys` — All registered keys.
- `size` — Count of registered clients.

---

### `GatewayServiceClient` (class) *(client module)*

A service client for the Gateway API. Accepts an `IHarborClient` via injection.

---

### `UsersServiceClient` (class) *(server module)*

A service client for the Users API. Accepts an `IHarborClient` via injection.

---

### `DocumentReaderServiceClient` (class) *(server module)*

A service client for the Document Reader API. Accepts an `IHarborClient` via injection.

---

### `ServiceClient` (abstract class)

Base class for all service-specific clients. Extend to create typed service clients
with an injected `IHarborClient`.

---

### `isHarborError(err)`

Returns `true` if `err` is an Axios-level error (network failure, HTTP error, timeout).

---

## Migration from v2

| v2 (procedural) | v3 (object-oriented) |
|---|---|
| `createHarborClient(options)` | `new HarborClient(options)` |
| `createIamHarborClient(options)` | `new IamHarborClient(options)` |
| `createServerHarborClient(options)` | `new ServerHarborClient(options)` |
| `HarborClient` (type alias for `AxiosInstance`) | `HarborClient` (class), `IHarborClient` (interface) |

> **Note:** v1 and v2 remain available for backward compatibility. Their procedural
> factory functions are deprecated — see each version's CHANGELOG for details.
