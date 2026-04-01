# ADR-011: Aegis and Harbor Client/Server Module Split

**Date:** 2026-04-01  
**Status:** Accepted

---

## Context

The Elastic Resume Base monorepo uses two shared libraries for cross-cutting concerns:

- **Aegis** (`shared/Aegis/`) — authentication abstraction layer. Under v1, the default
  package export (`.`) provided server-side token verification (`firebase-admin`), while a
  `./client` sub-path provided browser-side auth state management (`firebase/auth`).
  However, the default export acted as a mixed barrel: there was no explicit `./server`
  path, making the trust boundary invisible at the import level.

- **Harbor** (`shared/Harbor/`) — HTTP client abstraction. Under v1, the single package
  export (`.`) exposed only a basic Axios-based HTTP client factory with no
  service-to-service IAM authentication support. There was no client/server distinction.

Two risks arose as the project grew:

1. **Accidental cross-environment imports.** Without an explicit `./server` vs `./client`
   distinction, a developer working on the frontend could inadvertently import server-only
   symbols (e.g. `firebase-admin`, `google-auth-library`) that are unavailable in the
   browser or would bloat the client bundle.

2. **No IAM authentication for service-to-service calls.** The gateway-api communicates
   with internal services (users-api, document-reader, etc.) over HTTP. On Google Cloud
   Platform these services require Cloud Run service-to-service authentication via OIDC
   identity tokens. Harbor v1 provided no mechanism for attaching these tokens, requiring
   each service to implement its own ad-hoc solution.

These issues are addressed by introducing **v2** of both libraries following the
directory-based versioning convention established in
[ADR-010](ADR-010-shared-library-directory-architecture.md).

---

## Decision

### Aegis v2 (`shared/Aegis/v2/aegis_ts/`)

The package is restructured around two explicit sub-path exports:

| Export path | Environment | Contents |
|---|---|---|
| `@elastic-resume-base/aegis/server` | Node.js only | `initializeAuth`, `getTokenVerifier`, `ITokenVerifier`, `DecodedToken`, `AuthOptions`, `FirebaseTokenVerifier`, **`RequestContext`** |
| `@elastic-resume-base/aegis/client` | Browser | `initializeClientAuth`, `getClientAuth`, `IClientAuth`, `IAuthUser`, `AuthStateListener`, `ClientAuthOptions`, `FirebaseClientAuth` |

The **main export** (`.`) remains as an alias for `./server` for convenience. New code
should use `./server` or `./client` explicitly.

A new **`RequestContext` interface** is added to the server module as the canonical,
provider-agnostic representation of an authenticated request context derived from
server-side token verification:

```typescript
interface RequestContext {
  readonly uid: string;
  readonly email?: string;
  readonly name?: string;
  readonly picture?: string;
}
```

### Harbor v2 (`shared/Harbor/v2/harbor_ts/`)

The package exposes two explicit sub-path exports and **no root (`.`) export**:

| Export path | Environment | Contents |
|---|---|---|
| `@elastic-resume-base/harbor/client` | Browser & Node.js | `createHarborClient`, `HarborClientOptions`, `HarborClient`, `isHarborError` |
| `@elastic-resume-base/harbor/server` | Node.js only | All `./client` exports + `createIamHarborClient`, `IamHarborClientOptions` |

The **`createIamHarborClient`** factory (server module only) creates an Axios HTTP client
that automatically attaches a Google Cloud OIDC identity token to every outgoing request
using `google-auth-library` and Application Default Credentials (ADC). This enables
IAM-based service-to-service authentication for Cloud Run deployments without any
per-service boilerplate.

The absence of a root `.` export is intentional: it forces every consumer to pick either
`./client` or `./server`, making the trust boundary explicit and preventing accidental
bundling of server-only code into browser builds.

### Consumer updates

All consumers are updated in the same PR per the MAJOR version bump rules in
[ADR-009](ADR-009-shared-library-versioning.md):

| Service | Old import | New import |
|---|---|---|
| `apps/gateway-api` | `@elastic-resume-base/aegis` | `@elastic-resume-base/aegis/server` |
| `apps/gateway-api` | `@elastic-resume-base/harbor` | `@elastic-resume-base/harbor/server` |
| `apps/frontend` | `@elastic-resume-base/aegis/client` | `@elastic-resume-base/aegis/client` *(unchanged)* |

---

## Alternatives Considered

**ESLint path restriction rules instead of module split:** A custom ESLint rule could
forbid importing `@elastic-resume-base/aegis` (without `./client`) in frontend code.
While useful as a supplementary guard, it does not prevent a bundler from accidentally
including server-only code and relies on linting being run consistently. The module split
is a structural enforcement that works at compile time.

**Keep v1 with a `./server` alias added:** Adding `"./server": "./dist/index.js"` to the
v1 `package.json` `exports` map would expose the server path without a new version
directory. Rejected because v1's `package.json` already has a root `.` that exposes the
same symbols — the mixed barrel problem persists — and adding exports to a published
internal package without a version bump violates ADR-009.

**Single package with conditional exports by `browser` / `node` conditions:**
`package.json` conditional exports support `"browser"` and `"node"` environment keys.
This could automatically route browser bundlers to the client module. Rejected because:
(1) Node.js test runners do not set a `"browser"` condition, causing unreliable test
environments; (2) the explicit import path is more self-documenting and easier to enforce
via code review.

---

## Consequences

**Easier:**

- Trust boundaries are visible at every `import` statement: `./server` or `./client`
  makes the intent explicit.
- IAM-based service-to-service authentication is available from a single
  `createIamHarborClient` call with no per-service boilerplate.
- `RequestContext` provides a single canonical type for authenticated request data across
  all gateway services, replacing the need to destructure `DecodedToken` in every
  middleware.
- Frontend bundlers cannot accidentally pull `firebase-admin` or `google-auth-library`
  into the browser bundle because those symbols are only accessible via `./server`.

**Harder:**

- Each consuming service must reference a specific sub-path (`./server` or `./client`).
  The missing root `.` export on Harbor v2 will cause a compile error for any consumer
  that forgets to update the import path — which is intentional but requires awareness.
- Both `v1/` and `v2/` directories coexist until all consumers have migrated; bug fixes
  that affect both versions must be applied twice.

**Follow-on:**

- ESLint no-restricted-imports rules can be added to frontend `eslint.config.js` to
  reject any import from `@elastic-resume-base/aegis/server` or
  `@elastic-resume-base/harbor/server`.
- When Cloud Run IAM auth is fully validated in production, `createIamHarborClient` can
  become the default factory in `apps/gateway-api/src/utils/httpClient.ts` for all
  service-to-service calls.
- Future App Check verification can be integrated into the `./server` Aegis module
  without any change to the `./client` module or frontend code.
