# Project Initialization and Development Roadmap

This document outlines the infrastructure prerequisites, local development environment setup, and the recommended sequence for building the core microservices.

## 1. Infrastructure Prerequisites

Initialize the Google Cloud Platform (GCP) and Firebase environments, linking them to leverage shared infrastructure.

1. **Google Cloud Platform (GCP) Configuration:** * Navigate to the [Google Cloud Console](https://console.cloud.google.com) and provision a new project (e.g., `elastic-resume-base`). 
   * **Note:** A valid billing account must be attached to the project. While the application may operate within the free tier, a billing account is strictly required to provision services such as Vertex AI and Cloud Run.
2. **Firebase Integration:** * Navigate to the [Firebase Console](https://console.firebase.google.com). 
   * Click "Add Project" and select the existing GCP project created in Step 1 to establish the link.
3. **API Enablement:** * Within the GCP Console, ensure the following APIs are enabled:
     * Cloud Run API
     * Cloud Pub/Sub API
     * Vertex AI API
     * Cloud Translation API
     * Cloud Vision API
     * Cloud Key Management Service (KMS) API

---

## 2. Local Development & Emulation Strategy

To minimize cloud costs and accelerate development cycles, the architecture should be emulated locally wherever possible.

* **Google Cloud CLI (`gcloud`):** Install the CLI to facilitate terminal interactions with the GCP project.
* **Firebase CLI:** Install this toolset to access the **Firebase Local Emulator Suite**. This enables local, cost-free execution of Firestore, Firebase Auth, and Pub/Sub.
* **Application Default Credentials (ADC):** For cloud services lacking local emulation (e.g., Vertex AI, Translation, Vision), authenticate the local machine to interact with the production APIs. Execute `gcloud auth application-default login` to generate local credential files, allowing the development environment to securely interface with GCP.
* **Environment Configuration:** All environment variables for all services are defined in a single nested **`config.yaml`** at the repository root. This file is git-ignored; the committed template is **`config_example.yaml`**. To set up locally: copy the template (`cp config_example.yaml config.yaml`), fill in any sensitive values, then run `python3 scripts/setup-env.py` to generate per-service `.env` files for Docker Compose. See [Docker Orchestration](docker-orchestration.md) for full details.
* **Containerization (Docker):** As all services will ultimately target Cloud Run, components should be developed and tested within Docker containers. This ensures strict environmental parity between local development and production deployments.

---

## 3. Recommended Development Lifecycle

A backend-first development approach is recommended to ensure robust data flow and infrastructure stability prior to user interface implementation.

### Phase 1: Core Foundation (BFF, Database, Authentication)
* **Component:** Backend For Frontend (BFF) Gateway.
* **Recommended Stack:** Node.js (Express or Fastify) for optimal handling of asynchronous I/O and seamless Firebase Admin SDK integration.
* **Implementation Steps:**
  1. Initialize the Node.js service.
  2. Boot the Firebase Local Emulator Suite (Auth and Firestore).
  3. Implement token verification in the BFF and execute a test write operation to the emulated Firestore instance.

### Phase 2: Data Ingestion & AI Pipeline
* **Components:** Google Sheets Downloader & AI Processing Worker.
* **Recommended Stack:** Python (FastAPI or Flask) due to its robust data processing libraries and native Google Workspace SDK support.
* **Implementation Steps:**
  1. Construct an HTTP endpoint to fetch external sheet data and publish payloads to the emulated Pub/Sub topic.
  2. Implement the AI Worker service to subscribe to the Pub/Sub topic.
  3. Utilize the Vertex AI SDK to process raw text via Gemini 1.5 Flash, extract structured JSON, generate text embeddings, and persist the results to Firestore.

### Phase 3: Search and Retrieval Engine
* **Component:** Vector Search Base.
* **Recommended Stack:** Python, leveraging the FAISS library (which is natively optimized for C++ and Python environments).
* **Implementation Steps:** * Develop a service to ingest embeddings from Firestore, compile them into a local FAISS index, and expose an API endpoint for the BFF to execute similarity searches.

### Phase 4: Ancillary Microservices
* **Components:** File Generator, Document Reader (OCR), and Dead Letter Queue (DLQ) Notifier.
* **Recommended Stack:** Python or Node.js.
* **Implementation Steps:** * Develop these independent modules once the core pipeline (Phases 1–3) is stable and fully integrated.

### Phase 5: User Interface
* **Component:** Frontend Single Page Application (SPA).
* **Recommended Stack:** React, Vue, or Angular.
* **Implementation Steps:** * Construct the client-side application, integrate the Firebase Auth Client SDK for Google SSO, and establish routing to the BFF Gateway.