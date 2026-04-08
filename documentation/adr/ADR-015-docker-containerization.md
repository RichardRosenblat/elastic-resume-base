# ADR-015: Docker Containerization and Docker Compose for Local Development

**Date:** 2024-02-10
**Status:** Accepted

---

## Context

The platform consists of seven microservices (two Node.js, five Python) and a Firebase Emulator Suite. Developers need a way to:

- Run the complete stack locally without installing every language runtime and emulator dependency on the host
- Guarantee that local containers are built from the same Dockerfiles used in Cloud Run production deployments
- Manage configuration (environment variables) from a single place rather than per-service `.env` files
- Iterate quickly on code changes without full rebuilds

---

## Decision

Use **Docker multi-stage builds** for every service to produce minimal production images, and **Docker Compose v2** (`docker compose`) to orchestrate the full local stack.

Key design choices:

1. **Multi-stage Dockerfiles** — a `builder` stage installs dev dependencies and compiles TypeScript / resolves Python dependencies; the final stage copies only the runtime artefacts, keeping images lean.
2. **Single `config.yaml` file** — mounted read-only into every container at `/app/config.yaml`. Each service reads its section of the file via the Toolbox `loadConfigYaml` (Node.js) or Toolbox `load_config_yaml` (Python) utility. This eliminates per-service `.env` files and prevents secret sprawl.
3. **Firebase Emulator container** — a dedicated `firebase-emulator` service runs the Auth, Firestore, and Pub/Sub emulators so developers never need a live GCP project for local development.
4. **Application Default Credentials (ADC) mount** — the host's `~/.config/gcloud/application_default_credentials.json` is mounted into containers that call GCP APIs not covered by the emulators (e.g., Vertex AI, Cloud Vision).
5. **`depends_on` + health checks** — Node.js services wait for the Firebase Emulator to be healthy before starting, preventing auth/Firestore connection failures on cold starts.

---

## Alternatives Considered

| Option | Reason Not Chosen |
|--------|------------------|
| **Bare-metal (no containers)** | Inconsistent developer environments; requires every runtime and emulator installed locally; "works on my machine" problems |
| **Minikube / kind (local Kubernetes)** | Too heavy for local development; significant learning curve; overkill for a seven-service stack |
| **Podman** | Docker is the team's current standard; broader tooling support (Docker Desktop, VS Code Docker extension, CI/CD integration) |
| **Per-service `.env` files** | Secret sprawl; hard to keep in sync across services; `config.yaml` as a single source of truth is simpler and safer |

---

## Consequences

- **Easier:** Every developer gets an identical environment regardless of host OS; local and Cloud Run production images are built from the same Dockerfile; `docker compose up` starts the entire stack with a single command; `config.yaml` changes take effect after `docker compose restart <service>` without rebuilding.
- **Harder:** Docker must be installed on the host; first `docker compose up` takes a few minutes to build all images; ADC credentials must be refreshed when the GCP token expires (`gcloud auth application-default login`).
- **Follow-on decisions required:** Cloud Run deployment configuration (each service has its own Cloud Run service, built from the same Dockerfile used locally).
