# Getting Started

**Elastic Resume Base** is a cloud-native, microservices-based resume processing platform built on GCP and Firebase. It ingests resumes from Google Sheets/Drive, extracts structured data with Vertex AI, generates embeddings, and enables semantic search.

For a full setup walkthrough (GCP project, API enablement, emulator details) see [documentation/getting-started.md](documentation/getting-started.md).

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Git](https://git-scm.com/) | Any | Source control |
| [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/) | Compose v2+ | Run all services locally |
| [Node.js](https://nodejs.org/) | v22+ | Gateway API and Users API (outside Docker) |
| [Python](https://www.python.org/downloads/) | v3.11+ | Python microservices (outside Docker) |
| [gcloud CLI](https://cloud.google.com/sdk/docs/install) | Latest | Application Default Credentials |
| [Firebase CLI](https://firebase.google.com/docs/cli) | Latest | Local Firebase Emulator Suite |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/RichardRosenblat/elastic-resume-base.git
cd elastic-resume-base

# 2. Set up Application Default Credentials (for GCP APIs)
gcloud auth application-default login

# 3. Configure environment variables (single file for all services)
cp config_example.yaml config.yaml
# Edit config.yaml and fill in any required values

# 4. Build shared TypeScript libraries
./build_shared.sh      # Linux / macOS
# build_shared.bat     # Windows

# 5. Start all services with Firebase emulators
docker compose up
```

---

## Local Endpoints

Once the stack is up:

| Service | URL |
|---------|-----|
| Frontend SPA | http://localhost:5173 |
| Gateway API | http://localhost:3000 |
| Gateway Swagger Docs | http://localhost:3000/api/v1/docs |
| Users API | http://localhost:8005 |
| Users API Swagger Docs | http://localhost:8005/api/v1/docs |
| Document Reader | http://localhost:8004 |
| Document Reader Swagger Docs | http://localhost:8004/docs |
| Ingestor API | http://localhost:8001 |
| Ingestor API Swagger Docs | http://localhost:8001/docs |
| AI Worker | http://localhost:8006 |
| AI Worker Swagger Docs | http://localhost:8006/docs |
| DLQ Notifier | http://localhost:8007 |
| DLQ Notifier Swagger Docs | http://localhost:8007/docs |
| Firebase Emulator UI | http://localhost:4000 |

---

## Further Reading

- [Full Getting Started Guide](documentation/getting-started.md) — detailed setup, GCP project config, emulator tips
- [Services Overview](documentation/services.md) — what each service does
- [Architecture Decision Records](documentation/adr/README.md) — why key decisions were made
- [Contributing](CONTRIBUTING.md) — branch naming, commit format, PR process
