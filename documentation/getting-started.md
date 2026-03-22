# Getting Started

Welcome to **Elastic Resume Base**! This guide walks you through everything you need to get from a fresh clone to a fully running local development environment.

For a high-level overview of the project's architecture and services, see the [README](../README.md).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Configure GCP and Firebase](#3-configure-gcp-and-firebase)
4. [Set Up Environment Variables](#4-set-up-environment-variables)
5. [Build Shared Libraries](#5-build-shared-libraries)
6. [Install Service Dependencies](#6-install-service-dependencies)
7. [Run the Stack with Docker Compose](#7-run-the-stack-with-docker-compose)
8. [Verify Everything Is Working](#8-verify-everything-is-working)
9. [Run Tests Locally](#9-run-tests-locally)
10. [Next Steps](#10-next-steps)

---

## 1. Prerequisites

Install the following tools before you begin:

| Tool | Version | Purpose |
|------|---------|---------|
| [Git](https://git-scm.com/) | Any recent | Source control |
| [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/) | Compose v2+ | Running all services locally |
| [Node.js](https://nodejs.org/) | v22+ | BFF Gateway and Users API |
| [Python](https://www.python.org/downloads/) | v3.11+ | All Python microservices |
| [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) | Latest | Application Default Credentials and GCP access |
| [Firebase CLI](https://firebase.google.com/docs/cli) | Latest | Local Firebase Emulator Suite |

> **Note:** If you only plan to run the stack via Docker Compose, Node.js and Python are optional — the containers include everything needed. They are required if you want to run services locally outside Docker (e.g., `npm run dev`).

---

## 2. Clone the Repository

```bash
git clone https://github.com/RichardRosenblat/elastic-resume-base.git
cd elastic-resume-base
```

If you are contributing, fork the repository first and clone your fork instead:

```bash
git clone https://github.com/<your-username>/elastic-resume-base.git
cd elastic-resume-base
git remote add upstream https://github.com/RichardRosenblat/elastic-resume-base.git
```

---

## 3. Configure GCP and Firebase

The services use Google Cloud and Firebase for authentication, database, messaging, and AI. For local development, most of these are emulated — but you still need a GCP project linked to a Firebase project.

### 3.1 Create a GCP Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (e.g., `elastic-resume-base`).
3. Attach a billing account. *(Required by GCP even at free-tier usage — charges apply only above free limits.)*

### 3.2 Link to Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com).
2. Click **Add project** → select the GCP project you just created.

### 3.3 Enable Required GCP APIs

In the GCP Console, enable the following APIs for your project:

- Cloud Run API
- Cloud Pub/Sub API
- Vertex AI API
- Cloud Translation API
- Cloud Vision API
- Cloud Key Management Service (KMS) API

### 3.4 Set Up Application Default Credentials (ADC)

Services that call GCP APIs not covered by the local emulators (e.g., Vertex AI, Cloud Vision) use Application Default Credentials.

```bash
gcloud auth application-default login
```

This creates a local credential file that Docker mounts into the containers automatically.

> For a more detailed walkthrough see [Initial Setup](../documentation/initial-setup.md).

---

## 4. Set Up Environment Variables

All environment variables for all services are managed in a single file: **`config.yaml`** at the repository root.

```bash
# Copy the committed template
cp config_example.yaml config.yaml
```

Open `config.yaml` and fill in the values marked as empty strings — particularly:

| Variable | Where | What to put |
|----------|-------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | `systems.users-api` | Base64-encoded service account JSON key |
| `ADMIN_SHEET_FILE_ID` | `systems.users-api` | Google Drive file ID (optional) |
| `DLQ_SLACK_WEBHOOK_URL` | `systems.dlq-notifier` | Slack incoming webhook URL (optional) |

> **`config.yaml` is git-ignored.** Never commit it — it may contain credentials. The committed file is `config_example.yaml` (no secrets, safe defaults).

For a full explanation of every variable and how the config loading works, see [Docker Orchestration — Environment Configuration](../documentation/docker-orchestration.md#2-environment-configuration).

---

## 5. Build Shared Libraries

The repository contains shared TypeScript packages under `shared/`. These must be compiled before Node.js services can start.

**Linux / macOS:**
```bash
./build_shared.sh
```

**Windows:**
```bat
.\build_shared.bat
```

This installs dependencies and runs `npm run build` for each shared package in the correct dependency order. Re-run this script any time you modify a file under `shared/`.

> See [Monorepo Scripts](../documentation/monorepo-scripts.md) for details on what these scripts do and when to run them.

---

## 6. Install Service Dependencies

If you plan to run any service **outside Docker** (e.g., for debugging with `npm run dev`), install its dependencies locally:

**Node.js services:**
```bash
cd bff-gateway && npm install && cd ..
cd users-api && npm install && cd ..
```

**Python services** (example for one service — repeat as needed):
```bash
cd ingestor-service
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
cd ..
```

> If you are only using Docker Compose, skip this step — containers install their own dependencies at build time.

---

## 7. Run the Stack with Docker Compose

Docker Compose starts all services along with the Firebase Emulator Suite.

### First-time run

```bash
docker compose up
```

Docker will build all images on the first run. This may take a few minutes.

### Day-to-day

```bash
# Start everything
docker compose up

# Start specific services only
docker compose up bff-gateway users-api firebase-emulator

# Rebuild images after changing source code
docker compose up --build

# Stop all containers (keep volumes)
docker compose down

# Apply config.yaml changes without rebuilding
docker compose restart bff-gateway users-api
```

---

## 8. Verify Everything Is Working

Once the stack is up, open these URLs in your browser:

| Service | URL | What to check |
|---------|-----|---------------|
| BFF Gateway | http://localhost:3000/api/v1/docs | Swagger UI — all routes visible |
| Users API | http://localhost:8005/api/v1/docs | Swagger UI — all routes visible |
| Firebase Emulator UI | http://localhost:4000 | Firestore / Auth / Pub/Sub tabs visible |
| Firestore Emulator | http://localhost:8080 | Used internally by services |
| Firebase Auth Emulator | http://localhost:9099 | Used internally by services |
| Pub/Sub Emulator | http://localhost:8085 | Used internally by services |

A quick health-check for the BFF Gateway:

```bash
curl http://localhost:3000/api/v1/health
# Expected: {"status":"ok"} (or similar)
```

---

## 9. Run Tests Locally

### Node.js services

```bash
cd bff-gateway
npm run lint          # ESLint
npm run format:check  # Prettier
npm run typecheck     # TypeScript type-checking
npm test              # Jest (unit + integration)
```

```bash
cd users-api
npm run lint
npm run format:check
npm run typecheck
npm test
```

### Python services

```bash
cd <service-directory>
source .venv/bin/activate      # activate the virtual environment
black --check app/ tests/      # formatting check
ruff check app/ tests/         # linting
mypy app/                      # type-checking
pytest tests/ --cov=app --cov-report=term-missing
```

> The minimum required code coverage for business logic is **80%**. PRs that reduce coverage below this threshold will not be merged. See [Testing Strategy](../documentation/testing-strategy.md) for the full testing philosophy.

---

## 10. Next Steps

Now that your environment is running, here are good places to go next:

| Resource | Description |
|----------|-------------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Branch naming, commit message format, PR process |
| [Issue Templates Guide](./issue-templates.md) | When to use Bug Report, Feature Request, Tech Task, or Dev To-Do |
| [Labels Reference](./labels.md) | How to label issues correctly (required: Type + Priority + Area) |
| [Services Overview](../documentation/services.md) | Detailed description of each microservice |
| [Data Flow](../documentation/data-flow.md) | End-to-end data flow through all services |
| [Architecture Decision Records](../documentation/adr/) | Key architectural decisions and their rationale |
| [Python Coding Standards](../documentation/coding-standards/python-coding-standards.md) | Python style guide |
| [Node.js Coding Standards](../documentation/coding-standards/nodejs-coding-standards.md) | Node.js style guide |
| [Deployment Guide](../documentation/deployment.md) | How to deploy to Cloud Run (production) |
| [Troubleshooting](../documentation/troubleshooting.md) | Common issues and their solutions |

---

## Troubleshooting Quick Reference

| Symptom | Fix |
|---------|-----|
| `Cannot find module '@elastic-resume-base/...'` | Run `./build_shared.sh` (or `.bat`) and then `npm install` in the service directory |
| `ECONNREFUSED firebase-emulator:8080` | Wait for the Firebase Emulator UI at `http://localhost:4000`, then run `docker compose restart bff-gateway users-api` |
| Services don't pick up `config.yaml` changes | Run `docker compose restart <service-name>` |
| Port already in use | Stop the conflicting process or change the port mapping in `docker-compose.yml` |
| `config.yaml not found` | Run `cp config_example.yaml config.yaml` and fill in your values |

For more detailed solutions, see the [Troubleshooting Guide](../documentation/troubleshooting.md).
