# Shared Libraries Coding Standards

This document defines the standards for developing and maintaining the shared TypeScript libraries (`Synapse`, `Bowltie`, `Bugle`, `Toolbox`) under `shared/`.

---

## Purpose

Shared libraries eliminate code duplication across Node.js microservices. They are **internal packages** — not published to npm — and are installed via relative `file:` paths in `package.json`. Each library must be independently buildable, testable, and documented.

---

## Library Responsibilities

| Library | Package Name | Responsibility |
|---|---|---|
| **Synapse** | `@elastic-resume-base/synapse` | Error class hierarchy (`AppError`, `NotFoundError`, `ValidationError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `DownstreamError`), `UserRepository` interface, `FirestoreUserRepository` implementation |
| **Bowltie** | `@elastic-resume-base/bowltie` | Uniform API response envelope: `formatSuccess<T>()`, `formatError()`, `SuccessResponse<T>`, `ErrorResponse`, `ApiResponse<T>` |
| **Bugle** | `@elastic-resume-base/bugle` | Google API authentication (`getGoogleAuthClient`), Google Drive permissions (`DrivePermissionsService.getUsersWithFileAccess`) |
| **Toolbox** | `@elastic-resume-base/toolbox` | Config loading (`loadConfigYaml`), structured logger factory (`createLogger`), Fastify hooks (`correlationIdHook`, `createRequestLoggerHook`) |

---

## Package Structure

Each library must follow this structure:

```
shared/<LibraryName>/
├── src/
│   ├── index.ts          # Public API: re-exports everything consumers need
│   └── <module>.ts       # Implementation files
├── tests/
│   └── unit/
│       └── <module>.test.ts
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
└── README.md             # API reference with usage examples
```

---

## `index.ts` as Public Contract

- Every export that consumers should use **must** be exported from `src/index.ts`.
- Internal implementation details must **not** be exported from `index.ts`.
- Breaking changes to `index.ts` exports require updating all consuming services in the same PR.

---

## Versioning and Compatibility

- Libraries are not versioned independently — they are always consumed at the current monorepo `HEAD`.
- Breaking changes must be communicated in the PR description and applied to all consumers in the same PR.

---

## Error Class Design (Synapse)

- All custom errors must extend `AppError`.
- `AppError` carries `statusCode: number` and `code: string` (machine-readable identifier).
- `statusCode` maps to an HTTP status code: 4xx for client errors, 5xx for server errors.
- `code` is `UPPER_SNAKE_CASE` and identifies the error type programmatically.
- Use `isAppError(err)` type guard for safe narrowing in `catch` blocks.
- Never add business logic to error classes — they are pure data carriers.

---

## Response Envelope Design (Bowltie)

- All successful API responses use `formatSuccess<T>(data: T, correlationId?: string): SuccessResponse<T>`.
- All error responses use `formatError(code, message, correlationId?): ErrorResponse`.
- The `meta` field always includes `timestamp` (ISO-8601) and optionally `correlationId`.
- Never modify the envelope structure — consumers depend on its shape.

---

## Adding a New Export to a Shared Library

1. Implement the feature in `src/<module>.ts`.
2. Export it from `src/index.ts`.
3. Add unit tests in `tests/unit/<module>.test.ts`.
4. Update the library's `README.md` with the new API.
5. Rebuild the library: `npm run build`.
6. Update all consuming services if the API surface changes.

---

## Testing Shared Libraries

- Run `npm test` from within the library directory.
- Aim for **80% coverage minimum** — coverage must include all exported functions.
- Use `jest.mock()` to isolate external dependencies (e.g., `firebase-admin`, `google-auth-library`).
- Libraries must not have integration tests that call real GCP services.

---

## Development Commands

Run these commands from within the library directory (e.g., `cd shared/Synapse`):

```bash
npm install            # Install dependencies
npm run build          # Compile TypeScript to dist/
npm run lint           # Run ESLint
npm run typecheck      # Type-check without emitting output
npm test               # Run unit tests
npm run test:coverage  # Run tests with coverage report
```

---

## Build Order

The libraries have the following build-time dependency order. Always build them in this sequence:

1. **Synapse** — no shared-lib dependencies
2. **Bowltie** — depends on Synapse for error types
3. **Bugle** — no shared-lib dependencies
4. **Toolbox** — no shared-lib dependencies

The `build_shared.bat` / `build_shared.sh` scripts at the repo root iterate the `shared/` directory in filesystem order, which satisfies this dependency order. **Do not rename the library directories** without updating the build scripts.

See [Monorepo Scripts](../monorepo-scripts.md) for details on the build scripts.

---

## Related Documents

- [Node.js Coding Standards](nodejs-coding-standards.md) — Jest configuration for consuming services
- [Monorepo Scripts](../monorepo-scripts.md) — building all shared libraries with one command
- [ADR-001: Monorepo Structure](../adr/ADR-001-monorepo-structure.md) — rationale for the monorepo approach
