# Containerization and Local Orchestration

This document outlines the containerization strategy for the microservices architecture. Using Docker and Docker Compose ensures strict environmental parity across development teams and allows for seamless local emulation of Google Cloud services.

---

## 1. Repository Architecture

The monorepo centralises all deployment configuration. A single `config_example.yaml` file at the repository root is the **authoritative template for all service environment variables**; the user copies it to `config.yaml` (git-ignored) and fills in their values.

```text
elastic-resume-base/
├── firebase-emulator/         # Custom Dockerfile for Firebase Emulators
│   ├── Dockerfile
│   └── firebase.json
├── apps/
│   ├── gateway-api/           # Node.js Gateway API
│   │   ├── Dockerfile
│   │   ├── esbuild.config.mjs     # esbuild bundle configuration
│   │   └── package.json
│   ├── users-api/             # Node.js Users API
│   │   ├── Dockerfile
│   │   ├── esbuild.config.mjs     # esbuild bundle configuration
│   │   └── package.json
│   ├── frontend/              # React frontend
│   │   └── Dockerfile
│   └── [service-name]/        # Python microservices
│       ├── Dockerfile
│       └── requirements.txt
├── config_example.yaml        # ← Committed template (safe defaults, no secrets)
├── config.yaml                # ← Your local copy (git-ignored, fill in secrets)
└── docker-compose.yml         # Master orchestration file
```

---

## 2. Environment Configuration

All environment variables for all services are defined in a **single `config.yaml`** at the project root. This file is **git-ignored** — you create it locally by copying the committed template:

```bash
cp config_example.yaml config.yaml
```

### File structure

`config.yaml` uses a nested YAML structure. The `systems.shared` section contains variables that are inherited by every service; service-specific sections override or extend the shared values.

```yaml
systems:

  shared:                          # Inherited by every service
    NODE_ENV: development
    LOG_LEVEL: info
    FIREBASE_PROJECT_ID: demo-elastic-resume-base
    FIRESTORE_EMULATOR_HOST: "firebase-emulator:8080"
    # …

  gateway-api:                     # Gateway API-specific values
    PORT: "3000"
    ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:3000"
    USER_API_SERVICE_URL: "http://users-api:8005"
    # …

  users-api:                       # Users API-specific values
    PORT: "8005"
    GOOGLE_SERVICE_ACCOUNT_KEY: "" # fill in locally
    ADMIN_SHEET_FILE_ID: ""
    # …

  # (other services follow the same pattern)
```

See `config_example.yaml` for the full set of variables and inline documentation.

### How Node.js services read config.yaml

Each Node.js service reads `config.yaml` **directly at startup** — no preprocessing script is needed. The `src/utils/loadConfigYaml.ts` utility in each service:

1. Searches for `config.yaml` in the following order:
   - Path given by the `CONFIG_FILE` environment variable (explicit override)
   - `./config.yaml` relative to the current working directory (matches Docker containers where `config.yaml` is mounted at `/app/config.yaml`, and also matches running from the monorepo root)
   - `../config.yaml` one directory up (matches running `npm run dev` from inside the service directory)
2. Merges `systems.shared` with `systems.<service-name>` (service-specific values take precedence).
3. Writes each merged key into `process.env` — **only if that key is not already set**, so variables injected by the shell, Docker, or a test harness always win.
4. If `config.yaml` is not found or is malformed, the function returns silently and the service starts using Zod schema defaults and any pre-existing environment variables.

### How it works with Docker Compose

`docker-compose.yml` mounts `config.yaml` as a read-only file into each container:

```yaml
gateway-api:
  volumes:
    - ./config.yaml:/app/config.yaml:ro   # read by loadConfigYaml at startup

users-api:
  volumes:
    - ./config.yaml:/app/config.yaml:ro   # read by loadConfigYaml at startup
```

The service's WORKDIR is `/app`, so the search path `./config.yaml` resolves to `/app/config.yaml` — the mounted file.

### Filling in secrets

Edit `config.yaml` after copying the template. Secrets are empty strings in the example:

```yaml
systems:
  users-api:
    GOOGLE_SERVICE_ACCOUNT_KEY: ""   # ← paste your Base64-encoded JSON here
    ADMIN_SHEET_FILE_ID: ""          # ← optional Google Drive file ID

  dlq-notifier:
    DLQ_SLACK_WEBHOOK_URL: ""        # ← paste your Slack webhook URL here
```

After editing `config.yaml`, restart the affected containers:

```bash
docker compose restart gateway-api users-api
```

---

## 3. Firebase Emulator Containerization

Google does not provide a standalone Docker image for the Firebase Emulator Suite. A custom image is built that contains Node.js (for the Firebase CLI) and Java Runtime Environment (required for Firestore and Pub/Sub emulators).

**`firebase-emulator/Dockerfile`**

```dockerfile
FROM node:22-alpine

# Java JRE is required for Firestore and Pub/Sub emulators
RUN apk add --no-cache openjdk17-jre

RUN npm install -g firebase-tools

WORKDIR /srv/firebase

EXPOSE 9099 8080 8085 4000

CMD ["firebase", "emulators:start", "--project", "demo-elastic-resume-base", "--host", "0.0.0.0"]
```

---

## 4. Microservice Containerization

Each microservice has an independent `Dockerfile` for isolated builds and deployments.

### Node.js Services (`gateway-api`, `users-api`)

Both Node.js services use a two-stage Docker build. The builder stage runs `npm run build`, which:
1. **Type-checks** the TypeScript source with `tsc --noEmit`.
2. **Bundles** all application source files into a single `dist/server.js` using esbuild (see [Build Pipeline](#5-build-pipeline)).

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
```

### Python Microservices

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

---

## 5. Build Pipeline

### Node.js services — esbuild bundling

The `npm run build` command for each Node.js service runs two steps in sequence:

```
tsc --noEmit          →  TypeScript type-checking (no file output)
node esbuild.config.mjs  →  Bundle src/server.ts → dist/server.js
```

esbuild is configured in `esbuild.config.mjs` at the service root:

```javascript
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'bundled',   // keep npm packages in node_modules at runtime
  outfile: 'dist/server.js',
  sourcemap: true,
});
```

Key options:
- **`bundle: true`** — Recursively bundles all local `import` statements into a single file.
- **`packages: 'external'`** — npm packages are left as `import` statements pointing at `node_modules/`; this avoids bundling packages with native add-ons or dynamic `require()` (e.g. `firebase-admin`, `@fastify/swagger-ui`).
- **`format: 'esm'`** — Output is an ES module (matches `"type": "module"` in `package.json`).
- **`sourcemap: true`** — Produces `dist/server.js.map` for readable stack traces.

The result is a single `dist/server.js` file that the Docker runner stage executes directly.

---

## 6. Orchestration via Docker Compose

### First-time setup

```bash
# 1. Copy the template and fill in secrets
cp config_example.yaml config.yaml
# (open config.yaml and edit sensitive values)

# 2. Start everything — services read config.yaml at startup
docker compose up
```

### Day-to-day workflow

```bash
# Start all services
docker compose up

# Start specific services only
docker compose up gateway-api users-api

# Rebuild images after code changes
docker compose up --build

# Stop and remove containers
docker compose down

# Apply config changes without rebuilding images
docker compose restart gateway-api users-api
```

### Available local endpoints

| Service | URL |
|---|---|
| Gateway API | http://localhost:3000 |
| Gateway API Swagger UI | http://localhost:3000/api/v1/docs |
| Users API | http://localhost:8005 |
| Users API Swagger UI | http://localhost:8005/api/v1/docs |
| Firebase Emulator UI | http://localhost:4000 |
| Firestore Emulator | http://localhost:8080 |
| Firebase Auth Emulator | http://localhost:9099 |
| Pub/Sub Emulator | http://localhost:8085 |
