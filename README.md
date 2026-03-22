# Elastic Resume Base

A cloud-native, microservices-based resume processing platform built on Google Cloud Platform (GCP) and Firebase. This system ingests, extracts, embeds, and semantically searches resume data using AI and vector search technologies.

---

## Table of Contents

- [Overview](#overview)
- [Implementation Status](#implementation-status)
- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development Setup](#local-development-setup)
  - [Running with Docker Compose](#running-with-docker-compose)
- [Repository Structure](#repository-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Overview

Elastic Resume Base is an AI-powered resume management and search platform designed to help recruiters and HR teams efficiently process and search large volumes of resumes. The system is designed to process resumes through an intelligent pipeline:

1. **Ingest** resumes from Google Sheets/Drive
2. **Extract** structured data using Vertex AI (Gemini 1.5 Flash)
3. **Embed** extracted fields using multilingual text embeddings
4. **Search** resumes semantically using FAISS vector similarity

The architecture is optimized for cost-efficiency, operating almost entirely within GCP's free tier at baseline usage (~1,000 resumes/month at ~$0.25/month) while gracefully scaling to enterprise workloads.

---

## Implementation Status

This repository is under active development. The following table summarizes what is currently implemented versus what is planned:

| Service | Status | Notes |
|---|---|---|
| **BFF Gateway** | ✅ Implemented | Full auth, RBAC, user management routes |
| **Users API** | ✅ Implemented | Authorization logic, user CRUD, pre-approval management |
| **Shared Libraries** (Synapse, Bowltie, Bugle, Toolbox) | ✅ Implemented | Consumed by BFF Gateway and Users API |
| **Frontend SPA** | 🔄 Planned | Not yet implemented |
| **Ingestor Service** | 🔄 Planned | Not yet implemented |
| **AI Worker** | 🔄 Planned | Not yet implemented |
| **Search Base** | 🔄 Planned | Not yet implemented |
| **File Generator** | 🔄 Planned | Not yet implemented |
| **Document Reader** | 🔄 Planned | Not yet implemented |
| **DLQ Notifier** | 🔄 Planned | Not yet implemented |

---

## Architecture

### Current Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                     Client / Frontend                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / Firebase ID Token
┌────────────────────────▼────────────────────────────────────┐
│              BFF Gateway (Node.js – Cloud Run)              │
│          Verifies token · Calls Users API · RBAC            │
└────────────────────────┬────────────────────────────────────┘
                         │ Internal HTTP
┌────────────────────────▼────────────────────────────────────┐
│               Users API (Node.js – Cloud Run)               │
│  Authorization logic · User CRUD · Pre-approval management  │
└────────────────────────┬────────────────────────────────────┘
                         │ Synapse (persistence abstraction)
              ┌──────────▼──────────┐
              │  Firestore (NoSQL)  │
              │  + Cloud KMS (PII)  │
              └─────────────────────┘
```

### Full Target Architecture (Planned)

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│              Frontend SPA (Firebase Hosting)                │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / TLS
┌────────────────────────▼────────────────────────────────────┐
│              BFF Gateway (Node.js – Cloud Run)              │
└──┬─────────┬──────────┬──────────┬──────────┬──────────────┘
   │         │          │          │          │
   ▼         ▼          ▼          ▼          ▼
Users API Ingestor  Search Base  File Gen  Doc Reader
(Node.js) (Python)  (Python)     (Python)  (Python)
              │         ▲
       Pub/Sub│         │Pub/Sub
              ▼         │
          AI Worker ────┘
          (Python – Vertex AI)
              │
              ▼
    Firestore (via Synapse)
    Cloud KMS (PII encryption)
```

All inter-service communication is asynchronous via **Cloud Pub/Sub** where applicable. All data at rest is encrypted, with PII fields secured through **Cloud KMS**.

---

## Services

| Service | Language | Status | Description |
|---|---|---|---|
| **BFF Gateway** | Node.js | ✅ Implemented | Backend-for-Frontend: handles authentication, RBAC, and routes client requests to microservices |
| **Users API** | Node.js | ✅ Implemented | Manages user records, authorization logic, and pre-approval workflows |
| **Frontend SPA** | React / Vue / Angular | 🔄 Planned | User interface hosted on Firebase Hosting |
| **Ingestor Service** | Python | 🔄 Planned | Downloads resumes from Google Sheets/Drive, publishes to Pub/Sub |
| **AI Worker** | Python | 🔄 Planned | Extracts structured JSON and generates embeddings using Vertex AI |
| **Search Base** | Python | 🔄 Planned | Manages FAISS index and handles semantic vector search queries |
| **File Generator** | Python | 🔄 Planned | Generates resume documents and handles translation via Cloud Translation |
| **Document Reader** | Python | 🔄 Planned | OCR processing of scanned documents using Cloud Vision API |
| **DLQ Notifier** | Python | 🔄 Planned | Monitors Dead Letter Queue and sends failure alerts |

---

## Tech Stack

| Category | Technology |
|---|---|
| **Cloud Platform** | Google Cloud Platform (GCP) |
| **Compute** | Cloud Run (scale-to-zero containers) |
| **Database** | Firestore (NoSQL) |
| **Messaging** | Cloud Pub/Sub |
| **Authentication** | Firebase Auth (Google SSO) |
| **AI / ML** | Vertex AI – Gemini 1.5 Flash, Text Multilingual Embeddings |
| **Vector Search** | FAISS |
| **Translation** | Google Cloud Translation API |
| **OCR** | Google Cloud Vision API |
| **Secrets** | Google Cloud KMS |
| **Logging** | Google Cloud Logging |
| **Containerization** | Docker + Docker Compose |
| **BFF Language** | Node.js (Fastify v5) |
| **Worker Language** | Python 3.11 (FastAPI / Flask) |

---

## Getting Started

### Prerequisites

Ensure you have the following tools installed locally:

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- [Node.js](https://nodejs.org/) v22+ (for the BFF Gateway and Users API)
- [Python](https://www.python.org/downloads/) v3.11+ (for future Python microservices)
- [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install)
- [Firebase CLI](https://firebase.google.com/docs/cli)

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/RichardRosenblat/elastic-resume-base.git
   cd elastic-resume-base
   ```

2. **Configure GCP and Firebase:**
   - Create a GCP project at the [Google Cloud Console](https://console.cloud.google.com)
   - Link it to a Firebase project at the [Firebase Console](https://console.firebase.google.com)
   - Enable the required APIs (see [Initial Setup](documentation/initial-setup.md))

3. **Set up Application Default Credentials:**
   ```bash
   gcloud auth application-default login
   ```

4. **Configure environment variables:**
   ```bash
   # config.yaml is the single source of truth for all services.
   # It is git-ignored; config_example.yaml is the committed template.
   cp config_example.yaml config.yaml
   # Edit config.yaml and fill in any sensitive values
   # (GOOGLE_SERVICE_ACCOUNT_KEY, BOOTSTRAP_ADMIN_USER_EMAIL, etc.)
   ```

5. **Build shared libraries:**
   ```bash
   # Linux / macOS
   ./build_shared.sh

   # Windows
   build_shared.bat
   ```

6. **Install service dependencies:**
   ```bash
   # BFF Gateway
   cd bff-gateway && npm install

   # Users API
   cd users-api && npm install
   ```

### Running with Docker Compose

Before the first run, copy and configure the template:

```bash
# One-time setup: copy the template and fill in any sensitive values
cp config_example.yaml config.yaml
# (edit config.yaml with your values)
```

Then start the environment:

```bash
# Start all services with Firebase emulators
docker-compose up

# Start a single service
docker-compose up bff-gateway

# Rebuild after code changes
docker-compose up --build
```

The following local endpoints will be available:

| Service | URL |
|---|---|
| BFF Gateway | http://localhost:3000 |
| BFF Gateway API Docs (Swagger) | http://localhost:3000/api/v1/docs |
| Users API | http://localhost:8005 |
| Users API Docs (Swagger) | http://localhost:8005/api/v1/docs |
| Firebase Emulator UI | http://localhost:4000 |
| Firebase Auth Emulator | http://localhost:9099 |
| Firestore Emulator | http://localhost:8080 |
| Pub/Sub Emulator | http://localhost:8085 |

---

## Repository Structure

```
elastic-resume-base/
├── bff-gateway/               # ✅ Node.js BFF Gateway (Fastify v5)
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── users-api/                 # ✅ Node.js Users API Microservice
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── shared/                    # ✅ Shared TypeScript libraries
│   ├── Synapse/               # Persistence abstraction (Firestore via firebase-admin)
│   ├── Bowltie/               # Response formatting utilities
│   ├── Bugle/                 # Google API integration (Auth + Drive)
│   └── Toolbox/               # Cross-cutting utilities (logger, config loader, middleware)
├── firebase-emulator/         # Local Firebase Emulator setup
│   ├── Dockerfile
│   └── firebase.json
├── documentation/             # Project documentation
│   ├── adr/                   # Architecture Decision Records
│   ├── coding-standards/      # Language-specific coding standards
│   ├── data-flow.md
│   ├── deployment.md
│   ├── docker-orchestration.md
│   ├── getting-started.md
│   ├── initial-setup.md
│   ├── monorepo-scripts.md
│   ├── services.md
│   ├── testing-strategy.md
│   ├── troubleshooting.md
│   └── costs and services.md
├── config_example.yaml        # Environment configuration template (committed)
│                              # Copy to config.yaml (git-ignored) and edit
├── build_shared.sh            # Builds all shared libraries (Linux/macOS)
├── build_shared.bat           # Builds all shared libraries (Windows)
├── .gitignore
├── docker-compose.yml
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

---

## Documentation

| Document | Description |
|---|---|
| [Getting Started](documentation/getting-started.md) | End-to-end guide for setting up the local development environment |
| [Initial Setup](documentation/initial-setup.md) | GCP/Firebase project initialization and development roadmap |
| [Docker Orchestration](documentation/docker-orchestration.md) | Containerization strategy and Docker Compose configuration |
| [Services Overview](documentation/services.md) | Description of each microservice and shared library |
| [Data Flow](documentation/data-flow.md) | End-to-end data flow through all services |
| [Deployment Guide](documentation/deployment.md) | Cloud Run deployment, IAM setup, Pub/Sub provisioning |
| [Troubleshooting](documentation/troubleshooting.md) | Common issues and their solutions |
| [Testing Strategy](documentation/testing-strategy.md) | Testing philosophy, layers, mocking strategies, and coverage requirements |
| [Monorepo Scripts](documentation/monorepo-scripts.md) | Reference for root-level build and utility scripts |
| [Costs and Scaling](documentation/costs%20and%20services.md) | Cost analysis and scaling projections |
| [Architecture Decision Records](documentation/adr/README.md) | Records of key architectural decisions and their rationale |
| [Node.js Coding Standards](documentation/coding-standards/nodejs-coding-standards.md) | Node.js style guide and best practices |
| [Python Coding Standards](documentation/coding-standards/python-coding-standards.md) | Python style guide and best practices |
| [Shared Library Standards](documentation/coding-standards/shared-libraries-standards.md) | Coding standards for internal TypeScript packages |
| [Contributing](CONTRIBUTING.md) | How to contribute to this project |
| [Security](SECURITY.md) | Security policy and vulnerability reporting |

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to submit changes, report issues, and propose new features.

---

## Security

This project handles personally identifiable information (PII). All PII is encrypted at rest using Cloud KMS before being stored in Firestore. Please read our [Security Policy](SECURITY.md) for details on reporting vulnerabilities.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
