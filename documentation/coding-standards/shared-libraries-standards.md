# Shared Libraries Coding Standards

This document defines the standards for developing and maintaining the shared libraries (`Synapse`, `Bowltie`, `Bugle`, `Toolbox`, `Hermes` TypeScript, `Harbor` TypeScript/Python, `hermes` Python) under `shared/`.

---

## Purpose

Shared libraries eliminate code duplication across microservices. They are **internal packages** — not published to npm or PyPI — and are installed via relative `file:` paths (Node.js) or editable local paths (Python). Each library must be independently buildable, testable, and documented.

> **Exception — Toolbox:** `shared/Toolbox` is a plain collection of TypeScript source files with no `package.json`. Services import directly from its `src/` files using relative paths. No build step or `npm install` is required. See [Using Toolbox](nodejs-coding-standards.md#using-toolbox) for service integration details.

---

## Library Responsibilities

### TypeScript Libraries (Node.js services)

| Library | Package Name | Responsibility |
|---|---|---|
| **Synapse** | `@elastic-resume-base/synapse` | Error class hierarchy (`AppError`, `NotFoundError`, `ValidationError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `DownstreamError`), `UserRepository` interface, `FirestoreUserRepository` implementation |
| **Bowltie** | `@elastic-resume-base/bowltie` | Uniform API response envelope: `formatSuccess<T>()`, `formatError()`, `SuccessResponse<T>`, `ErrorResponse`, `ApiResponse<T>` |
| **Bugle** | `@elastic-resume-base/bugle` | Google API authentication (`getGoogleAuthClient`), Google Drive permissions (`DrivePermissionsService.getUsersWithFileAccess`) |
| **Hermes** | `@elastic-resume-base/hermes` | Messaging abstraction: `IMessagingService`, `SmtpMessagingService`, `initializeMessaging`, `getMessagingService` |
| **Harbor** | `@elastic-resume-base/harbor` | HTTP request abstraction: `createHarborClient()`, `HarborClientOptions`, `HarborClient`, `isHarborError()` |
| **Toolbox** | *(plain source, no package name)* | Config loading (`loadConfigYaml`), structured logger factory (`createLogger`), Fastify hooks (`correlationIdHook`, `createRequestLoggerHook`) |

### Python Libraries (Python services)

| Library | Package Name | Responsibility |
|---|---|---|
| **hermes** | `elastic-resume-base-hermes` | Messaging abstraction: `IMessagingService` protocol, `SmtpMessagingService`, `initialize_messaging`, `get_messaging_service` |
| **harbor** | `elastic-resume-base-harbor` | HTTP request abstraction: `create_harbor_client()`, `HarborClient`, `HarborClientOptions`, `is_harbor_error()` |

---

## Package Structure

### TypeScript Libraries

Each TypeScript library (Synapse, Bowltie, Bugle, Hermes) must follow this structure:

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

**Toolbox** is an exception — it contains only `src/` and `README.md` with no build infrastructure:

```
shared/Toolbox/
├── src/
│   ├── index.ts
│   ├── createLogger.ts
│   ├── loadConfigYaml.ts
│   └── middleware/
│       ├── correlationId.ts
│       └── requestLogger.ts
└── README.md
```

Toolbox unit tests live in `bff-gateway/tests/unit/toolbox/` and run as part of the bff-gateway test suite.

### Python Libraries

Each Python library (e.g. `hermes`) must follow this structure:

```
shared/<library-name>/
├── <package>/
│   ├── __init__.py       # Public API: re-exports everything consumers need
│   ├── interfaces/
│   │   ├── __init__.py
│   │   └── <interface>.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── <service>.py
│   └── <module>.py       # Implementation files
├── tests/
│   ├── __init__.py
│   ├── conftest.py       # pytest fixtures (including singleton reset)
│   └── test_<module>.py
├── pyproject.toml
├── requirements.txt       # Production dependencies (pinned)
├── requirements-dev.txt   # Dev/test dependencies
└── README.md              # API reference with usage examples
```

- Use **`snake_case`** for all Python package and module names.
- Install via `pip install -e ../shared/<library-name>` (editable local path).

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

For **Synapse, Bowltie, or Bugle**:

1. Implement the feature in `src/<module>.ts`.
2. Export it from `src/index.ts`.
3. Add unit tests in `tests/unit/<module>.test.ts`.
4. Update the library's `README.md` with the new API.
5. Rebuild the library: `npm run build`.
6. Update all consuming services if the API surface changes.

For **Toolbox**:

1. Implement the feature in `src/<module>.ts`.
2. Export it from `src/index.ts`.
3. Add unit tests in `bff-gateway/tests/unit/toolbox/<module>.test.ts`.
4. Update `shared/Toolbox/README.md` with the new API.
5. No build step required — consuming services import source directly.
6. Ensure the consuming service's `package.json` includes any new external dependency used by the module (Toolbox has no `node_modules` of its own).

---

## Testing Shared Libraries

### TypeScript

For **Synapse, Bowltie, Bugle, and Hermes**: run `npm test` from within the library directory.

For **Toolbox**: run `npm test` from within the `bff-gateway/` directory (Toolbox tests live in `bff-gateway/tests/unit/toolbox/`).

### Python

For **hermes** (Python): run `pytest tests/` from within `shared/hermes/`.

Aim for **80% coverage minimum** — coverage must include all exported functions.
Use `jest.mock()` (TypeScript) or `unittest.mock` / `pytest-mock` (Python) to isolate external dependencies.
Libraries must not have integration tests that call real GCP services.

---

## Development Commands

### TypeScript

Run these commands from within the library directory (e.g., `cd shared/Synapse`):

```bash
npm install            # Install dependencies
npm run build          # Compile TypeScript to dist/
npm run lint           # Run ESLint
npm run typecheck      # Type-check without emitting output
npm test               # Run unit tests
npm run test:coverage  # Run tests with coverage report
```

**Toolbox** requires no commands — it has no `package.json`. Its tests run as part of `bff-gateway`:

```bash
cd bff-gateway
npm test
```

### Python

Run these commands from within the Python library directory (e.g., `cd shared/hermes`):

```bash
pip install -r requirements-dev.txt   # Install dev + prod dependencies
pip install -e .                      # Install the package in editable mode
ruff check hermes/ tests/             # Lint
black hermes/ tests/                  # Format
mypy hermes/                          # Type-check
pytest tests/                         # Run unit tests
pytest tests/ --cov=hermes --cov-report=term-missing  # With coverage
```

---

## Build Order

### TypeScript

The TypeScript libraries have the following build-time dependency order. Always build them in this sequence:

1. **Synapse** — no shared-lib dependencies
2. **Bowltie** — depends on Synapse for error types
3. **Bugle** — no shared-lib dependencies
4. **Hermes** — no shared-lib dependencies

**Toolbox** is not included in the build order — it has no `package.json` and is automatically skipped by `build_shared.bat` / `build_shared.sh`.

The `build_shared.bat` / `build_shared.sh` scripts at the repo root iterate the `shared/` directory in filesystem order and only process directories that contain a `package.json`. **Do not rename the library directories** without updating the build scripts.

### Python

Python libraries have no build step, but they do have to be imported by the consuming services using either `pip install -e ../shared/<library-name>` or by adding the shared library as a local path dependency in the consuming service's `requirements_dev.txt`. But at production, they should be installed as normal dependencies in the consuming service's `requirements_prod.txt` (not editable local paths).

1. **hermes** — no shared-lib dependencies

See [Monorepo Scripts](../monorepo-scripts.md) for details on the build scripts.

---

## Related Documents

- [Node.js Coding Standards](nodejs-coding-standards.md) — Jest configuration for consuming services
- [Monorepo Scripts](../monorepo-scripts.md) — building all shared libraries with one command
- [ADR-001: Monorepo Structure](../adr/ADR-001-monorepo-structure.md) — rationale for the monorepo approach
