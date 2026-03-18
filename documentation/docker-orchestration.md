# Containerization and Local Orchestration

This document outlines the containerization strategy for the microservices architecture. Using Docker and Docker Compose ensures strict environmental parity across development teams and allows for seamless local emulation of Google Cloud services.

---

## 1. Repository Architecture

The monorepo centralises all deployment configuration and facilitates local orchestration. A single `env.yaml` file at the repository root is the **authoritative source of environment variables for every service**; there are no per-service `.env` or `.env.example` files.

```text
elastic-resume-base/
├── firebase-emulator/     # Custom Dockerfile for Firebase Emulators
│   ├── Dockerfile
│   └── firebase.json
├── bff-gateway/           # Node.js BFF Gateway
│   ├── Dockerfile
│   ├── src/
│   └── package.json
├── users-api/             # Node.js Users API
│   ├── Dockerfile
│   ├── src/
│   └── package.json
├── [service-name]/        # Python microservices (e.g. ingestor-service, search-base)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── env.yaml               # ← Single root-level environment configuration
└── docker-compose.yml     # Master orchestration file
```

---

## 2. Environment Configuration (`env.yaml`)

All environment variables for all services are stored in **`env.yaml`** at the project root.  This file ships with safe default values for local development and is committed to version control.  Sensitive values (credentials, webhook URLs, service-account keys) are intentionally left empty and must be supplied locally — never committed.

> **Requires Docker Compose ≥ 2.24.0** for `env_file` YAML format support.

### File layout

`env.yaml` is a flat YAML key-value map organised into labelled sections:

```yaml
# Shared / Cross-Service
NODE_ENV: development
LOG_LEVEL: info
GCP_PROJECT_ID: demo-elastic-resume-base
FIREBASE_PROJECT_ID: demo-elastic-resume-base
FIRESTORE_EMULATOR_HOST: "firebase-emulator:8080"
FIREBASE_AUTH_EMULATOR_HOST: "firebase-emulator:9099"
PUBSUB_EMULATOR_HOST: "firebase-emulator:8085"

# BFF Gateway
ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:3000"
USER_API_SERVICE_URL: "http://users-api:8005"
# … (see full file for all variables)

# Users API
GOOGLE_SERVICE_ACCOUNT_KEY: ""   # fill in locally
ADMIN_SHEET_FILE_ID: ""          # optional
```

### Adding local secrets

Because `env.yaml` is committed, do **not** write real credentials into it.  Use one of these approaches instead:

1. **`docker-compose.override.yml`** (recommended) — Docker Compose automatically merges this file, and it is git-ignored:

   ```yaml
   # docker-compose.override.yml (git-ignored)
   services:
     users-api:
       environment:
         GOOGLE_SERVICE_ACCOUNT_KEY: "<your-real-value>"
   ```

2. **Shell environment variables** — export the variable in your shell before running `docker-compose up`; Docker Compose `environment:` entries without a value are passed through from the shell.

---

## 3. Firebase Emulator Containerization

Google does not provide a standalone Docker image for the Firebase Emulator Suite. A custom image is built that contains Node.js (for the Firebase CLI) and Java Runtime Environment (required for Firestore and Pub/Sub emulators).

**`firebase-emulator/Dockerfile`**

```dockerfile
FROM node:20-alpine

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

### Node.js Services (`bff-gateway`, `users-api`)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
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

## 5. Orchestration via Docker Compose

`docker-compose.yml` reads environment variables from `env.yaml` using the `env_file` attribute with `format: yaml`.  Service-specific values that differ between containers (such as `PORT`) are set explicitly in each service's `environment:` block, which takes precedence over `env_file`.

```yaml
# docker-compose.yml (simplified excerpt)
services:
  firebase-emulator:
    build:
      context: ./firebase-emulator
    ports:
      - "4000:4000"
      - "9099:9099"
      - "8080:8080"
      - "8085:8085"

  bff-gateway:
    build:
      context: ./bff-gateway
    ports:
      - "3000:3000"
    env_file:
      - path: ./env.yaml
        format: yaml
    environment:
      PORT: "3000"      # service-specific override
    depends_on:
      - firebase-emulator
      - users-api

  users-api:
    build:
      context: .
      dockerfile: users-api/Dockerfile
    ports:
      - "8005:8005"
    env_file:
      - path: ./env.yaml
        format: yaml
    environment:
      PORT: "8005"      # service-specific override
    depends_on:
      - firebase-emulator
```

---

## 6. Operational Workflow

```bash
# Start all services (Firebase Emulators + BFF Gateway + Users API)
docker-compose up

# Start only specific services
docker-compose up bff-gateway users-api

# Rebuild images after code changes
docker-compose up --build

# Stop and remove containers
docker-compose down
```

Available local endpoints after `docker-compose up`:

| Service | URL |
|---|---|
| BFF Gateway | http://localhost:3000 |
| BFF Swagger UI | http://localhost:3000/api/v1/docs |
| Users API | http://localhost:8005 |
| Users API Swagger UI | http://localhost:8005/api/v1/docs |
| Firebase Emulator UI | http://localhost:4000 |
| Firestore Emulator | http://localhost:8080 |
| Firebase Auth Emulator | http://localhost:9099 |
| Pub/Sub Emulator | http://localhost:8085 |

