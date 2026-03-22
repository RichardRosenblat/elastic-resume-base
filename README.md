# Elastic Resume Base

A cloud-native, microservices-based resume processing platform built on Google Cloud Platform (GCP) and Firebase. This system ingests, extracts, embeds, and semantically searches resume data using AI and vector search technologies.

---

## Table of Contents

- [Overview](#overview)
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

Elastic Resume Base is an AI-powered resume management and search platform designed to help recruiters and HR teams efficiently process and search large volumes of resumes. The system processes resumes through an intelligent pipeline:

1. **Ingest** resumes from Google Sheets/Drive
2. **Extract** structured data using Vertex AI (Gemini 1.5 Flash)
3. **Embed** extracted fields using multilingual text embeddings
4. **Search** resumes semantically using FAISS vector similarity

The architecture is optimized for cost-efficiency, operating almost entirely within GCP's free tier at baseline usage (~1,000 resumes/month at ~$0.25/month) while gracefully scaling to enterprise workloads.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│              Frontend SPA (Firebase Hosting)                │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / TLS
┌────────────────────────▼────────────────────────────────────┐
│              BFF Gateway (Node.js – Cloud Run)              │
└──┬─────────────┬──────────────┬──────────────┬─────────────┘
   │             │              │              │
   ▼             ▼              ▼              ▼
Ingestor     Search Base    File Generator  Document Reader
(Python)     (Python+FAISS) (Python)        (Python – OCR)
   │
   ▼ Pub/Sub
AI Worker (Python – Vertex AI)
   │
   ▼
Firestore (Synapse Abstraction Layer)
```

All inter-service communication is asynchronous via **Cloud Pub/Sub** where applicable. All data at rest is encrypted, with PII fields secured through **Cloud KMS**.

---

## Services

| Service | Language | Description |
|---|---|---|
| **Frontend SPA** | React / Vue / Angular | User interface hosted on Firebase Hosting |
| **BFF Gateway** | Node.js | Backend-for-Frontend: routes client requests to microservices |
| **Ingestor Service** | Python | Downloads resumes from Google Sheets/Drive, publishes to Pub/Sub |
| **AI Worker** | Python | Extracts structured JSON and generates embeddings using Vertex AI |
| **Search Base** | Python | Manages FAISS index and handles semantic vector search queries |
| **File Generator** | Python | Generates resume documents and handles translation via Cloud Translation |
| **Document Reader** | Python | OCR processing of scanned documents using Cloud Vision API |
| **DLQ Notifier** | Python | Monitors Dead Letter Queue and sends failure alerts |

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
- [Node.js](https://nodejs.org/) v22+ (for the BFF Gateway)
- [Python](https://www.python.org/downloads/) v3.11+ (for Python microservices)
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
   # (GOOGLE_SERVICE_ACCOUNT_KEY, DLQ_SLACK_WEBHOOK_URL, etc.)
   ```

5. **Install service dependencies:**
   ```bash
   # BFF Gateway
   cd bff-gateway && npm install

   # Python services (example for ingestor-service)
   cd ingestor-service && pip install -r requirements.txt
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
| Firebase Emulator UI | http://localhost:4000 |
| Ingestor Service | http://localhost:8000 |
| Firebase Auth Emulator | http://localhost:9099 |
| Firestore Emulator | http://localhost:8080 |
| Pub/Sub Emulator | http://localhost:8085 |

---

## Repository Structure

```
elastic-resume-base/
├── bff-gateway/               # Node.js BFF Gateway
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── users-api/                 # Node.js Users API Microservice
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── shared/                    # Shared TypeScript libraries
│   ├── Synapse/               # Error classes + Firestore user repository
│   ├── Bowltie/               # Response formatting utilities
│   └── Bugle/                 # Google Auth + Drive permissions
├── ingestor-service/          # Python Ingestion Worker
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── ai-worker/                 # Python AI Processing Worker
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── search-base/               # Python FAISS Search Service
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── file-generator/            # Python File Generator Service
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── document-reader/           # Python OCR Service
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── dlq-notifier/              # Python DLQ Monitor
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── firebase-emulator/         # Local Firebase Emulator Setup
│   ├── Dockerfile
│   └── firebase.json
├── documentation/             # Project documentation
│   ├── coding-standards/
│   │   ├── python-coding-standards.md
│   │   └── nodejs-coding-standards.md
│   ├── initial-setup.md
│   ├── docker-orchestration.md
│   ├── services.md
│   └── costs and services.md
├── config_example.yaml        # Environment configuration template (committed)
│                              # Copy to config.yaml (git-ignored) and edit
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
| [Initial Setup](documentation/initial-setup.md) | GCP/Firebase project initialization and development roadmap |
| [Docker Orchestration](documentation/docker-orchestration.md) | Containerization strategy and Docker Compose configuration |
| [Services Overview](documentation/services.md) | Detailed description of each microservice |
| [Costs and Scaling](documentation/costs%20and%20services.md) | Cost analysis and scaling projections |
| [Architecture Decision Records](documentation/adr/README.md) | Records of key architectural decisions and their rationale |
| [Data Flow](documentation/data-flow.md) | End-to-end data flow through all services |
| [Testing Strategy](documentation/testing-strategy.md) | Testing philosophy, layers, mocking strategies, and coverage requirements |
| [Deployment Guide](documentation/deployment.md) | Cloud Run deployment, IAM setup, Pub/Sub provisioning |
| [Troubleshooting](documentation/troubleshooting.md) | Common issues and their solutions |
| [Python Coding Standards](documentation/coding-standards/python-coding-standards.md) | Python style guide and best practices |
| [Node.js Coding Standards](documentation/coding-standards/nodejs-coding-standards.md) | Node.js style guide and best practices |
| [Shared Library Standards](documentation/coding-standards/shared-libraries-standards.md) | Coding standards for internal TypeScript packages |
| [Monorepo Scripts](documentation/monorepo-scripts.md) | Reference for root-level build and utility scripts |
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
