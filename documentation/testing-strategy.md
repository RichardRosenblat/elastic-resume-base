# Testing Strategy

This document describes the testing philosophy, layers, mocking strategies, and coverage requirements for the Elastic Resume Base project.

---

## Philosophy

- Tests are a first-class concern — every PR that modifies logic must include tests.
- **80% minimum code coverage** on business logic, enforced in CI.
- Prefer unit tests for isolated logic; use integration tests for the HTTP layer end-to-end within a single service.
- Never test infrastructure (Firestore internals, Pub/Sub delivery) — mock at the boundary.

---

## Test Layers

### Unit Tests

- Test a single function or class in isolation.
- All external dependencies (Firestore, Pub/Sub, downstream HTTP, Google APIs) must be mocked.
- Live in `tests/unit/`.
- File naming: `<subject>.test.ts` (Node.js) or `test_<subject>.py` (Python).

### Integration Tests (HTTP Layer)

- Test a complete HTTP request/response cycle within a single service using the in-process server.
- **Node.js:** Use Fastify's `app.inject()` — never spin up a real HTTP server or use `supertest`.
- **Python:** Use `fastapi.testclient.TestClient` or Flask's `app.test_client()`.
- Live in `tests/integration/`.
- External services (Firestore, Pub/Sub) are still mocked at the SDK/client level.

### Cross-Service Integration Tests

Cross-service integration tests are **not** in scope for the monorepo test suite. Full end-to-end testing is handled by the Docker Compose environment. See [Docker Orchestration](docker-orchestration.md).

---

## Mocking Strategy (Node.js)

- Use `jest.mock()` for module-level mocks (e.g., `firebase-admin`).
- Use `jest.spyOn()` for method-level mocks on existing objects.
- Use `jest.fn()` for inline stubs.
- Map shared packages to their TypeScript source via `moduleNameMapper` in `jest.config.cjs` to avoid ESM/CJS interop issues. See [Node.js Coding Standards](coding-standards/nodejs-coding-standards.md).
- Reset mocks between tests using `jest.clearAllMocks()` in `afterEach`.

Example `jest.config.cjs` mapping:

```javascript
moduleNameMapper: {
  '^@elastic-resume-base/synapse$': '<rootDir>/../../shared/Synapse/v1/synapse_ts/src/index.ts',
  '^@elastic-resume-base/bowltie$': '<rootDir>/../../shared/Bowltie/v1/bowltie_ts/src/index.ts',
  '^@elastic-resume-base/bugle$':   '<rootDir>/../../shared/Bugle/v1/bugle_ts/src/index.ts',
  '^@elastic-resume-base/harbor$':  '<rootDir>/../../shared/Harbor/v1/harbor_ts/src/index.ts',
  '^@shared/toolbox$':              '<rootDir>/../../shared/Toolbox/v1/toolbox_ts/src/index.ts',
},
```

---

## Mocking Strategy (Python)

- Use `unittest.mock.patch` or `pytest-mock`'s `mocker` fixture.
- Mock Google SDK clients at instantiation (e.g., `firestore.Client`, `pubsub_v1.SubscriberClient`).
- Use the `responses` library for mocking outbound HTTP calls in Python services.

---

## Running Tests

### Node.js Services

```bash
cd apps/gateway-api   # or apps/users-api, shared/Synapse, etc.
npm test                      # run all tests
npm run test:coverage         # run with coverage report
```

### Python Services

```bash
cd <service-directory>
pytest tests/ -v
pytest tests/ --cov=app --cov-report=term-missing
```

### All Shared Libraries

```bash
# From the repo root (Windows)
.\build_shared.bat

# From the repo root (Linux/macOS)
./build_shared.sh
```

See [Monorepo Scripts](monorepo-scripts.md) for details on the build scripts.

---

## Coverage Thresholds

| Language | Minimum Coverage | Configuration |
|---|---|---|
| Node.js | 80% | `coverageThreshold` in `jest.config.cjs` |
| Python | 80% | `--cov-fail-under=80` in `pytest.ini` or `pyproject.toml` |

PRs that reduce coverage below the threshold will not be merged.

---

## CI Enforcement

All tests run in CI on every push. A PR cannot be merged if:

- Any test fails.
- Code coverage drops below the 80% threshold.

---

## Related Documents

- [Node.js Coding Standards](coding-standards/nodejs-coding-standards.md) — Jest configuration details
- [Python Coding Standards](coding-standards/python-coding-standards.md) — pytest configuration details
- [Shared Library Standards](coding-standards/shared-libraries-standards.md) — testing shared libraries
- [Monorepo Scripts](monorepo-scripts.md) — building shared libraries before running tests
