# @elastic-resume-base/aegis (v2)

**Aegis** is the shared authentication abstraction library for Elastic Resume Base microservices.

Version 2 introduces a strict **client/server module split**, ensuring that server-only
logic (firebase-admin token verification) and client-only logic (firebase browser SDK) can
never be accidentally mixed or exposed to the wrong environment.

---

## Module Split

| Import path | Environment | Purpose |
|---|---|---|
| `@elastic-resume-base/aegis/server` | Node.js (server-side only) | Token verification, `RequestContext` |
| `@elastic-resume-base/aegis/client` | Browser (client-side only) | Sign-in, sign-out, auth state |

> **Rule:** Backend services import from `./server`. Frontend code imports from `./client`.
> The main package root (`.`) is an alias for `./server` kept for convenience, but
> explicit `./server` imports are preferred.

---

## Server Module (`./server`)

### Quick Start

```typescript
import { initializeAuth, getTokenVerifier } from '@elastic-resume-base/aegis/server';
import type { RequestContext } from '@elastic-resume-base/aegis/server';

// Call once at application startup
initializeAuth({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project' });

// In an auth middleware:
const decoded = await getTokenVerifier().verifyToken(bearerToken);
const ctx: RequestContext = {
  uid: decoded.uid,
  email: decoded.email,
  name: decoded.name,
  picture: decoded.picture,
};
```

### API Reference

#### `initializeAuth(options: AuthOptions): void`

Initialises the Aegis authentication layer. **Idempotent** — subsequent calls are no-ops.
Call once at application startup before verifying any tokens.

| Option | Type | Description |
|---|---|---|
| `projectId` | `string` | Firebase / Google Cloud project identifier |
| `serviceAccountKey` | `string` (optional) | Service-account JSON (raw or Base64-encoded). Omit to use Application Default Credentials. |

#### `terminateAuth(): Promise<void>`

Terminates the authentication layer and releases all resources. **Idempotent**.

#### `getTokenVerifier(): ITokenVerifier`

Returns the initialised `ITokenVerifier` singleton. Throws if `initializeAuth` has not been called.

#### `RequestContext` (interface)

Unified provider-agnostic representation of an authenticated request context.

```typescript
interface RequestContext {
  readonly uid: string;
  readonly email?: string;
  readonly name?: string;
  readonly picture?: string;
}
```

#### `ITokenVerifier` (interface)

```typescript
interface ITokenVerifier {
  verifyToken(token: string): Promise<DecodedToken>;
}
```

#### `DecodedToken` (type)

```typescript
interface DecodedToken {
  readonly uid: string;
  readonly email?: string;
  readonly name?: string;
  readonly picture?: string;
}
```

---

## Client Module (`./client`)

### Quick Start

```typescript
import { initializeClientAuth, getClientAuth } from '@elastic-resume-base/aegis/client';

// Call once at application startup (e.g. in the module that mounts React).
initializeClientAuth({
  apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

// In an AuthContext / auth hook:
const auth = getClientAuth();

auth.onAuthStateChanged((user) => {
  console.log(user ? `Signed in: ${user.email}` : 'Signed out');
});

await auth.signInWithEmailAndPassword('user@example.com', 'password');
const token = await auth.getCurrentUser()?.getIdToken();
```

### API Reference

#### `initializeClientAuth(options: ClientAuthOptions): void`

Initialises the Aegis client-side authentication layer. **Idempotent**.

| Option | Type | Description |
|---|---|---|
| `apiKey` | `string` | Firebase Web API key |
| `authDomain` | `string` | Firebase Auth domain |
| `projectId` | `string` | Firebase / Google Cloud project identifier |
| `authEmulatorHost` | `string` (optional) | Firebase Auth emulator host (e.g. `localhost:9099`) |

#### `getClientAuth(): IClientAuth`

Returns the initialised `IClientAuth` singleton. Throws if `initializeClientAuth` has not been called.

#### `IClientAuth` (interface)

```typescript
interface IClientAuth {
  onAuthStateChanged(listener: AuthStateListener): () => void;
  signInWithEmailAndPassword(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  getCurrentUser(): IAuthUser | null;
  sendPasswordResetEmail(email: string): Promise<void>;
}
```

---

## Installation

Harbor is an internal package installed via a relative `file:` path:

```json
{
  "dependencies": {
    "@elastic-resume-base/aegis": "file:../../shared/Aegis/v2/aegis_ts"
  }
}
```

## Building

```bash
cd shared/Aegis/v2/aegis_ts
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
| `from '@elastic-resume-base/aegis'` | `from '@elastic-resume-base/aegis/server'` |
| `from '@elastic-resume-base/aegis/client'` | `from '@elastic-resume-base/aegis/client'` *(unchanged)* |
