# Aegis (TypeScript)

Aegis is the **sole authentication abstraction layer** for Elastic Resume Base microservices. It owns every aspect of token verification and client-side authentication — from SDK initialisation through to decoded-token delivery — so that consuming services remain completely free of any direct `firebase-admin` or `firebase` dependency.

The library exposes two entry points:

| Entry point | Use case |
|---|---|
| `@elastic-resume-base/aegis` (default) | **Server-side** token verification in Node.js services |
| `@elastic-resume-base/aegis/client` | **Client-side** auth operations in browser / React applications |

> **Python version:** There is no Python equivalent of Aegis — Firebase Admin SDK initialisation in Python services is handled directly by [Synapse](../../../Synapse/v1/synapse_py/README.md).

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Firebase Admin SDK initialisation | ✅ Aegis (`initializeAuth`) |
| Server-side ID token verification | ✅ Aegis (`getTokenVerifier().verifyToken`) |
| Firebase client SDK initialisation | ✅ Aegis (`initializeClientAuth`) |
| Client-side sign-in / sign-out | ✅ Aegis (`getClientAuth()`) |
| Auth state observation | ✅ Aegis (`IClientAuth.onAuthStateChanged`) |
| Business logic / HTTP routing | ❌ Consuming service |
| Response formatting | ❌ [Bowltie](../../../Bowltie/v1/bowltie_ts/README.md) |
| Persistence | ❌ [Synapse](../../../Synapse/v1/synapse_ts/README.md) |

---

## Installation

Aegis is an internal package — not published to npm. Install it via a local path reference.

```bash
npm install ../shared/Aegis/v1/aegis_ts
```

If Aegis hasn't been built yet, build it first:

```bash
cd shared/Aegis/v1/aegis_ts
npm install
npm run build
```

Or build all shared packages at once from the monorepo root:

```bash
.\build_shared.bat
```

---

## Quick Start

### Server-side (Node.js service)

```typescript
import { initializeAuth, getTokenVerifier } from '@elastic-resume-base/aegis';

// 1. Call once at application startup — before verifying any tokens.
initializeAuth({
  projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project',
  serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, // optional
});

// 2. In an auth middleware — verify the bearer token from the Authorization header.
const decoded = await getTokenVerifier().verifyToken(bearerToken);
console.log(decoded.uid, decoded.email);
```

### Client-side (React / browser)

```typescript
import { initializeClientAuth, getClientAuth } from '@elastic-resume-base/aegis/client';

// 1. Call once at application startup (e.g. in main.tsx, before rendering).
initializeClientAuth({
  apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

// 2. In an AuthContext or auth hook.
const auth = getClientAuth();

auth.onAuthStateChanged((user) => {
  console.log(user ? `Signed in: ${user.email}` : 'Signed out');
});

await auth.signInWithEmailAndPassword('user@example.com', 'password');
await auth.signInWithGoogle();
const token = await auth.getCurrentUser()?.getIdToken();
await auth.signOut();
```

---

## Modules

### Server: Auth initialisation (`auth.ts`)

Every server-side service must call `initializeAuth` **once** at startup before any token verification is performed.

#### `initializeAuth(options: AuthOptions): void`

Initialises the Aegis authentication layer. Idempotent — subsequent calls after the first are no-ops.

| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | `string` | ✅ | Firebase / Google Cloud project identifier. |
| `serviceAccountKey` | `string` | ❌ | Raw JSON **or** Base64-encoded JSON service-account key. Omit to use Application Default Credentials (ADC). |

#### `terminateAuth(): Promise<void>`

Terminates the authentication layer and releases all resources. Call during graceful shutdown.

```typescript
process.on('SIGTERM', async () => {
  await terminateAuth();
  process.exit(0);
});
```

#### `getTokenVerifier(): ITokenVerifier`

Returns the initialised token verifier singleton.

Throws `Error` if `initializeAuth` has not been called.

---

### Server: Token verifier interface (`interfaces/token-verifier.ts`)

Services depend on the `ITokenVerifier` interface — not on any concrete implementation — so the authentication provider can be swapped without touching business logic.

```typescript
interface ITokenVerifier {
  verifyToken(token: string): Promise<DecodedToken>;
}
```

#### `DecodedToken`

| Field | Type | Description |
|---|---|---|
| `uid` | `string` | Unique identifier for the authenticated user. |
| `email` | `string \| undefined` | Email address associated with the account. |
| `name` | `string \| undefined` | Display name of the user. |
| `picture` | `string \| undefined` | URL of the user's profile picture. |

---

### Server: Firebase implementation (`firebase-token-verifier.ts`)

`FirebaseTokenVerifier` is the default `ITokenVerifier` implementation. It is created automatically by `initializeAuth` — direct instantiation is only needed for advanced use cases.

```typescript
import { FirebaseTokenVerifier } from '@elastic-resume-base/aegis';

const verifier = new FirebaseTokenVerifier({
  projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project',
});

const decoded = await verifier.verifyToken(idToken);
```

If a Firebase Admin app has already been initialised (e.g. by Synapse), the existing app is reused automatically.

---

### Client: Auth initialisation (`client-auth.ts`)

Every browser-side entry point must call `initializeClientAuth` **once** at startup before any auth operations are performed.

#### `initializeClientAuth(options: ClientAuthOptions): void`

Initialises the client-side authentication layer. Idempotent.

| Field | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | ✅ | Firebase Web API key (`VITE_FIREBASE_API_KEY`). |
| `authDomain` | `string` | ✅ | Firebase Auth domain (`VITE_FIREBASE_AUTH_DOMAIN`). |
| `projectId` | `string` | ✅ | Firebase / Google Cloud project identifier. |
| `authEmulatorHost` | `string` | ❌ | Local Firebase Auth emulator host (e.g. `localhost:9099`). |

#### `terminateClientAuth(): Promise<void>`

Terminates the client auth layer. Idempotent.

#### `getClientAuth(): IClientAuth`

Returns the initialised client auth singleton. Throws `Error` if `initializeClientAuth` has not been called.

---

### Client: Client auth interface (`interfaces/client-auth.ts`)

Frontend code depends on `IClientAuth` and never imports `firebase/auth` directly.

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

#### `IAuthUser`

| Field | Type | Description |
|---|---|---|
| `uid` | `string` | Unique identifier for the authenticated user. |
| `email` | `string \| null` | Email address, or `null` if not available. |
| `displayName` | `string \| null` | Display name, or `null` if not available. |
| `photoURL` | `string \| null` | Profile photo URL, or `null` if not available. |
| `getIdToken()` | `() => Promise<string>` | Retrieves a fresh Firebase ID token for the current user. |

---

## Implementing a New Auth Provider

### Server-side

1. Create a class that implements `ITokenVerifier`.
2. Use `_setTokenVerifier` (testing) or replace the `initializeAuth` call (production) with your implementation.

```typescript
import type { ITokenVerifier, DecodedToken } from '@elastic-resume-base/aegis';

class Auth0TokenVerifier implements ITokenVerifier {
  async verifyToken(token: string): Promise<DecodedToken> {
    // Verify using Auth0 SDK...
    return { uid: payload.sub, email: payload.email };
  }
}
```

### Client-side

1. Create a class that implements `IClientAuth`.
2. Use `_setClientAuth` (testing) or replace the `initializeClientAuth` call with your implementation.

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
