# Troubleshooting Guide

This document covers common issues encountered during local development, testing, and deployment of the Elastic Resume Base system.

---

## Shared Library Build Issues

### Problem: `Cannot find module '@elastic-resume-base/toolbox'`

**Cause:** The shared library has not been built yet, or `npm install` has not been run in the service directory.

**Solution:**

```bash
# Build all shared libraries at once
.\build_shared.bat        # Windows
./build_shared.sh         # Linux/macOS

# Then reinstall in the affected service
cd apps/gateway-api && npm install
```

### Problem: TypeScript compilation fails after modifying a shared library

**Cause:** The service still uses the old compiled `dist/` output from the shared library.

**Solution:** Rebuild the modified library and then re-run the service:

```bash
cd shared/Toolbox/v1/toolbox_ts && npm run build
# Then restart the service
cd ../../../../apps/gateway-api && npm run dev
```

### Problem: `build_shared.bat` is not available on Linux/macOS

**Solution:** Use `build_shared.sh` instead. If it is missing, run each shared package manually:

```bash
for dir in shared/*/v1/; do
  if [ -f "${dir}package.json" ]; then
    (cd "$dir" && npm install && npm run build)
  fi
done
```

---

## Docker Compose Issues

### Problem: Services fail with `ECONNREFUSED firebase-emulator:8080`

**Cause:** The `firebase-emulator` container is not ready yet when dependent services start.

**Solution:** Wait for the Firebase Emulator UI at `http://localhost:4000` to become accessible, then restart the failing services:

```bash
docker compose restart gateway-api users-api
```

### Problem: `config.yaml` not found / service fails to read environment variables

**Cause:** `config.yaml` has not been created from the template.

**Solution:**

```bash
cp config_example.yaml config.yaml
# Edit config.yaml and fill in required values
docker compose up --build
```

### Problem: Changes to `config.yaml` are not reflected in running containers

**Solution:**

```bash
docker compose restart <service-name>
```

> `restart` does **not** rebuild the image — this is correct for configuration changes. Use `docker compose up --build` only when source code has changed.

### Problem: Port conflict — a service fails to bind

**Cause:** Another process on the host is already using one of the mapped ports.

**Solution:** Find and stop the conflicting process, or change the port mapping in `docker-compose.yml`:

```bash
# macOS / Linux
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

After changing a port in `docker-compose.yml`, update the corresponding value in `config.yaml`.

---

## Firebase Emulator Issues

### Problem: Firestore Emulator UI shows no data after importing

**Cause:** The emulator data directory is not mounted correctly in the Docker Compose configuration.

**Solution:** Check that the `firebase-emulator` service in `docker-compose.yml` has the correct volume mount for the data directory. Refer to the Firebase Emulator documentation for the expected directory structure.

### Problem: `Firebase Auth Emulator is not running` error

**Cause:** The `FIREBASE_AUTH_EMULATOR_HOST` environment variable is not set, so the SDK tries to connect to real Firebase Auth.

**Solution:** Ensure `config.yaml` has the following in `systems.shared`:

```yaml
systems:
  shared:
    FIREBASE_AUTH_EMULATOR_HOST: "firebase-emulator:9099"
```

### Problem: Pub/Sub emulator not delivering messages

**Cause:** The topic or subscription was not created in the emulator, or the push endpoint URL is incorrect.

**Solution:** Check the Firebase Emulator UI at `http://localhost:4000` → **Pub/Sub** tab to verify topics and subscriptions are present. Ensure the push endpoint in each subscription points to the correct Docker Compose service name and port (e.g., `http://ai-worker:8001/pubsub/push`).

---

## FAISS Index Issues

### Problem: Search Base returns no results after restart

**Cause:** The FAISS index is stored in memory and is lost on container restart.

**Solution:** Trigger an index rebuild by calling `POST /api/v1/index/rebuild` on the Search Base service. Alternatively, ensure the rebuild-on-startup logic is implemented and that the `FAISS_INDEX_PATH` volume is mounted correctly so the index persists across restarts.

### Problem: FAISS index rebuild takes a long time

**Cause:** A large number of resumes must be loaded from Firestore and re-indexed on startup.

**Solution:** Persist the FAISS index to a Docker volume by setting `FAISS_INDEX_PATH: /app/data/resume.faiss` in `config.yaml`. This is the default in `config_example.yaml`. With a persisted index, the Search Base loads from disk on startup instead of rebuilding from Firestore.

---

## Test Issues

### Problem: Jest tests fail with `Cannot use import statement in a CommonJS module`

**Cause:** ESM/CJS interop issue — shared packages are ES modules but Jest runs in a CommonJS context.

**Solution:** Ensure `moduleNameMapper` in `jest.config.cjs` maps all `@elastic-resume-base/*` packages to their TypeScript source files:

```javascript
moduleNameMapper: {
  '^@elastic-resume-base/synapse$': '<rootDir>/../../shared/Synapse/v1/synapse_ts/src/index.ts',
  '^@elastic-resume-base/bowltie$': '<rootDir>/../../shared/Bowltie/v1/bowltie_ts/src/index.ts',
  '^@elastic-resume-base/bugle$':   '<rootDir>/../../shared/Bugle/v1/bugle_ts/src/index.ts',
  '^@elastic-resume-base/harbor$':  '<rootDir>/../../shared/Harbor/v1/harbor_ts/src/index.ts',
  '^@shared/toolbox$':              '<rootDir>/../../shared/Toolbox/v1/toolbox_ts/src/index.ts',
},
```

See [Node.js Coding Standards](coding-standards/nodejs-coding-standards.md) for the full Jest configuration.

### Problem: Python tests fail with `ModuleNotFoundError`

**Cause:** Dependencies are not installed in the current virtual environment.

**Solution:**

```bash
cd <service-directory>
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
pytest tests/
```

---

## Distributed Tracing Issues

### Problem: Log entries are missing `correlationId`, `traceId`, or `spanId`

**Cause (Node.js):** The `correlationIdHook` is not registered in the Fastify application, or it is registered after the request logger hook.

**Solution:** Ensure `correlationIdHook` (or `createCorrelationIdHook(logger)`) is registered as the **first** `onRequest` hook:

```typescript
app.addHook('onRequest', correlationIdHook);
app.addHook('onResponse', createRequestLoggerHook(logger));
```

**Cause (Python):** `CorrelationIdMiddleware` is not added to the FastAPI application.

**Solution:** Add it before other middleware:

```python
app.add_middleware(CorrelationIdMiddleware)
```

---

### Problem: `WARN x-correlation-id header absent` appears in every log entry

**Cause:** The upstream caller is not forwarding the `x-correlation-id` header. This warning should never appear for frontend-originated requests because the frontend Axios client generates a UUID v4 `x-correlation-id` for every request. It should also never appear for service-to-service calls.

**Solution for frontend requests:** Ensure the frontend's Axios interceptor in `apps/frontend/src/services/api.ts` is generating the header. The interceptor sets `reqConfig.headers['x-correlation-id'] = crypto.randomUUID()` before every outbound call. If you are making requests via a different code path (e.g. a raw `fetch` call or a separate Axios instance), add the header there as well.

**Solution for service-to-service calls:** Ensure the calling service propagates tracing headers. In the Gateway API this is handled automatically by the Axios interceptor in `src/utils/httpClient.ts` — all clients created via `createHttpClient()` will forward the current request's tracing headers. Do not bypass `createHttpClient` with a raw Axios instance.

---

### Problem: `WARN x-cloud-trace-context header absent; derived trace context from correlation ID`

**Cause:** The upstream caller is not forwarding the `x-cloud-trace-context` header. This is **expected behavior for frontend-originated requests** — the frontend intentionally does not set this header (it is an internal server-side tracing concern). The Gateway API derives the trace context from the `x-correlation-id` header sent by the frontend instead.

**Note:** If this warning appears for service-to-service calls, the upstream service is not propagating trace headers. In the Gateway API this is handled automatically by the Axios interceptor in `createHttpClient()`. Check that all downstream calls go through `createHttpClient` rather than a raw Axios instance.

---

## Related Documents

- [Docker Orchestration](docker-orchestration.md) — Docker Compose configuration details
- [Testing Strategy](testing-strategy.md) — test layers and mocking strategies
- [Deployment Guide](deployment.md) — production deployment and IAM setup
- [Monorepo Scripts](monorepo-scripts.md) — building shared libraries
