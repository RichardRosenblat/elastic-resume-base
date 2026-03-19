# ADR-006: Use Node.js for Gateway Services, Python for AI/Data Workers

**Date:** 2024-01-01  
**Status:** Accepted

---

## Context

The system has two distinct workload categories:

1. **I/O-bound request routing** — authenticating and forwarding HTTP requests between the frontend and downstream services (BFF Gateway, Users API).
2. **CPU/AI-bound data processing** — calling Vertex AI, running FAISS, performing OCR, generating documents, and processing Pub/Sub messages (Ingestor, AI Worker, Search Base, File Generator, Document Reader, DLQ Notifier).

These two categories have different runtime requirements and library ecosystems.

## Decision

- **BFF Gateway** and **Users API** are Node.js (TypeScript, Fastify v5).
- **All AI/data processing microservices** (Ingestor, AI Worker, Search Base, File Generator, Document Reader, DLQ Notifier) are Python 3.11.

## Alternatives Considered

**All Node.js:** Unified language stack, simpler hiring and tooling. Rejected because Python has significantly more mature AI/ML libraries (FAISS, Vertex AI SDKs, PyMuPDF, Google Vision) and is the de-facto standard for ML workloads.

**All Python:** Unified language stack on the Python side. Rejected because Node.js/Fastify is significantly better suited for I/O-bound HTTP routing, and the Firebase Admin SDK has more complete Node.js support (e.g., Auth management, custom claims).

**Go for the gateway:** Go has excellent performance for HTTP routing and a strong GCP SDK. Rejected because the team's existing expertise is in Node.js and TypeScript, and Fastify v5 provides equivalent performance for this workload.

## Consequences

- **Easier:** Each language is used where it excels — Node.js for fast async I/O routing, Python for AI/ML workloads.
- **Easier:** Firebase Admin SDK integration in Node.js (Auth management, custom token generation) is straightforward.
- **Harder:** Two language ecosystems in the monorepo — separate dependency files (`package.json`, `requirements.txt`), separate linters, separate test runners, and separate coding standards documents.
- **Harder:** Shared configuration must bridge both ecosystems. This is achieved via `config.yaml` at the monorepo root, which both Node.js (`loadConfigYaml.ts`) and Python services read at startup.
- **Follow-on:** Separate coding standards documents are maintained for each language. See [Node.js Coding Standards](../coding-standards/nodejs-coding-standards.md) and [Python Coding Standards](../coding-standards/python-coding-standards.md).
