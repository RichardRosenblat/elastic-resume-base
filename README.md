# Elastic Resume Base

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![GCP](https://img.shields.io/badge/Google_Cloud-Platform-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Hosting-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-Jest_%7C_Vitest_%7C_pytest-brightgreen)](https://docs.pytest.org/)
[![Coverage](https://img.shields.io/badge/Coverage-%E2%89%A580%25-brightgreen)](https://coverage.readthedocs.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A cloud-native, microservices-based resume processing platform built on Google Cloud Platform (GCP) and Firebase. This system ingests, extracts, embeds, and semantically searches resume data using AI and vector search technologies.

---

## Table of Contents

- [Elastic Resume Base](#elastic-resume-base)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Implementation Status](#implementation-status)
  - [Architecture](#architecture)
    - [Current Implementation](#current-implementation)
    - [Full Target Architecture (Planned)](#full-target-architecture-planned)
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
| **Gateway** | ✅ Implemented | Full auth, RBAC, user management routes |
| **Users API** | ✅ Implemented | Authorization logic, user CRUD, pre-approval management |
| **Shared Libraries** (Synapse, Bowltie, Bugle, Aegis, Toolbox, Hermes) | ✅ Implemented | TypeScript libs consumed by Gateway and Users API; Hermes also available as Python package |
| **Frontend SPA** | ✅ Implemented | React + TypeScript SPA with Firebase Auth, i18n, MUI, and feature flags |
| **Ingestor Service** | ✅ Implemented | Pub/Sub pipeline, PDF/DOCX text extraction, Google Sheets/Drive integration (port 8001) |
| **AI Worker** | ✅ Implemented | Vertex AI extraction (Gemini 1.5 Flash), multilingual text embeddings, Firestore persistence (port 8006) |
| **Search Base** | 🔄 Planned | Not yet implemented |
| **File Generator** | 🔄 Planned | Not yet implemented |
| **Document Reader** | ✅ Implemented | OCR and structured data extraction from Brazilian documents using Cloud Vision API (port 8004) |
| **DLQ Notifier** | ✅ Implemented | Monitors Dead Letter Queue, stores notifications in Firestore, sends email alerts (port 8007) |

---

## Architecture

### Current Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                     Client / Frontend                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / Firebase ID Token
┌────────────────────────▼────────────────────────────────────┐
│              Gateway (Node.js – Cloud Run)                  │
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
│              Gateway (Node.js – Cloud Run)                  │
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
| **Gateway** | Node.js | ✅ Implemented | Handles authentication, RBAC, and routes client requests to microservices |
| **Users API** | Node.js | ✅ Implemented | Manages user records, authorization logic, and pre-approval workflows |
| **Frontend SPA** | React + TypeScript | ✅ Implemented | User interface hosted on Firebase Hosting; integrates with Gateway |
| **Ingestor Service** | Python | ✅ Implemented | Downloads resumes from Google Sheets/Drive, extracts text from PDF/DOCX, publishes to Pub/Sub |
| **AI Worker** | Python | ✅ Implemented | Extracts structured JSON and generates embeddings using Vertex AI |
| **Search Base** | Python | 🔄 Planned | Manages FAISS index and handles semantic vector search queries |
| **File Generator** | Python | 🔄 Planned | Generates resume documents and handles translation via Cloud Translation |
| **Document Reader** | Python | ✅ Implemented | OCR processing of scanned documents and field extraction using Cloud Vision API |
| **DLQ Notifier** | Python | ✅ Implemented | Monitors Dead Letter Queue and sends failure alerts; stores notifications in Firestore |

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
| **Gateway Language** | Node.js (Fastify v5) |
| **Worker Language** | Python 3.11 (FastAPI / Flask) |

---

## Getting Started

### Prerequisites

Ensure you have the following tools installed locally:

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- [Node.js](https://nodejs.org/) v22+ (for the Gateway and Users API)
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
   # Gateway API
   cd apps/gateway-api && npm install

   # Users API
   cd apps/users-api && npm install

   # Frontend
   cd apps/frontend && npm install
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
docker-compose up gateway-api

# Rebuild after code changes
docker-compose up --build
```

The following local endpoints will be available:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Document Reader | http://localhost:8004 |
| Document Reader API Docs (Swagger) | http://localhost:8004/docs |
| Ingestor API | http://localhost:8001 |
| Ingestor API Docs (Swagger) | http://localhost:8001/docs |
| AI Worker | http://localhost:8006 |
| AI Worker API Docs (Swagger) | http://localhost:8006/docs |
| DLQ Notifier | http://localhost:8007 |
| DLQ Notifier API Docs (Swagger) | http://localhost:8007/docs |
| Gateway | http://localhost:3000 |
| Gateway API Docs (Swagger) | http://localhost:3000/api/v1/docs |
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
├── apps/
│   ├── gateway-api/               # ✅ Node.js Gateway API (Fastify v5)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── users-api/                 # ✅ Node.js Users API Microservice
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── frontend/                  # ✅ React + TypeScript SPA (Vite)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── document-reader/           # ✅ Python Document Reader (FastAPI, port 8004)
│   │   ├── app/
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   ├── ingestor-api/              # ✅ Python Ingestor Service (FastAPI, port 8001)
│   │   ├── app/
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   ├── ai-worker/                 # ✅ Python AI Worker Service (FastAPI, port 8006)
│   │   ├── app/
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   └── dlq-notifier/              # ✅ Python DLQ Notifier Service (FastAPI, port 8007)
│       ├── app/
│       ├── Dockerfile
│       └── pyproject.toml
├── shared/                    # ✅ Shared libraries (TypeScript + Python)
│   ├── Synapse/               # Persistence abstraction (Firestore via firebase-admin)
│   ├── Bowltie/               # Response formatting utilities (TypeScript + Python)
│   ├── Bugle/                 # Google API integration (Auth + Drive)
│   ├── Aegis/                 # Auth abstraction (Firebase Admin / Firebase Client)
│   ├── Toolbox/               # Cross-cutting utilities — logger, errors (TypeScript + Python)
│   └── Hermes/                # Messaging abstraction (SMTP — TypeScript + Python)
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
├── build_shared.sh            # Builds all TypeScript shared libraries (Linux/macOS)
├── build_shared.bat           # Builds all TypeScript shared libraries (Windows)
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
| [Quick Start](GETTING_STARTED.md) | Fast setup guide — clone, configure, and run in minutes |
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
| [Frontend Coding Standards](documentation/coding-standards/frontend-coding-standards.md) | React/TypeScript style guide and best practices for the frontend SPA |
| [Python Coding Standards](documentation/coding-standards/python-coding-standards.md) | Python style guide and best practices |
| [Shared Library Standards](documentation/coding-standards/shared-libraries-standards.md) | Coding standards for internal TypeScript packages |
| [Frontend README](frontend/README.md) | Frontend SPA setup, environment variables, and development guide |
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
