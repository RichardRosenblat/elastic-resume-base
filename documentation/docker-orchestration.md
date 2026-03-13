# Containerization and Local Orchestration

This document outlines the containerization strategy for the microservices architecture. Utilizing Docker and Docker Compose ensures strict environmental parity across development teams and allows for seamless local emulation of Google Cloud services.

## 1. Repository Architecture

A monorepo structure is recommended to centralize the deployment configuration and facilitate local orchestration. The repository should be structured as follows:

```text
elasstic-resume-base/
├── firebase-emulator/     # Custom Dockerfile for Emulators
│   ├── Dockerfile
│   └── firebase.json
├── bff-gateway/           # Node.js Gateway Service
│   ├── Dockerfile
│   ├── package.json
│   └── index.js
├── [service name]/      # examples: ingestor-service, vector-search-service, etc.
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── .env                   # Local secrets (Excluded from version control)
└── docker-compose.yml     # Master Orchestration File

```

---

## 2. Firebase Emulator Containerization

Google does not provide a standalone, lightweight Docker image exclusively for the Firebase Emulator Suite. A custom image must be built containing Node.js (for the Firebase CLI) and Java Runtime Environment (required for the Firestore and Pub/Sub emulators).

**`firebase-emulator/Dockerfile`**

```dockerfile
# Base image: Node.js
FROM node:20-alpine

# Install Java JRE (Required for Firestore/PubSub emulators)
RUN apk add --no-cache openjdk17-jre

# Install the Firebase CLI globally
RUN npm install -g firebase-tools

WORKDIR /srv/firebase

# Expose required emulator ports (Auth, Firestore, Pub/Sub, UI)
EXPOSE 9099 8080 8085 4000

# Initialize emulators. The "demo-" prefix prevents the CLI from 
# attempting to authenticate with live GCP credentials.
CMD ["firebase", "emulators:start", "--project", "demo-elasstic-resume-base", "--host", "0.0.0.0"]

```

---

## 3. Microservice Containerization

Each microservice requires an independent `Dockerfile` to allow for isolated builds and deployments.

### Node.js Gateway (`bff-gateway/Dockerfile`)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Utilize a development dependency (e.g., nodemon) for hot-reloading
CMD ["npm", "run", "dev"] 

```

### Python Ingestion Worker (`ingestor-service/Dockerfile`)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Utilize an ASGI server (e.g., uvicorn) for hot-reloading
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

```

---

## 4. Orchestration via Docker Compose

The `docker-compose.yml` file, located at the repository root, orchestrates the networking and environment variables required to route local traffic to the emulators rather than production Google Cloud endpoints.

**`docker-compose.yml`**

```yaml
version: '3.8'

services:
  # 1. Local Firebase/GCP Emulation Environment
  firebase-emulator:
    build:
      context: ./firebase-emulator
    ports:
      - "4000:4000" # Emulator UI
      - "9099:9099" # Authentication
      - "8080:8080" # Firestore
      - "8085:8085" # Pub/Sub
    volumes:
      - ./firebase-emulator/firebase.json:/srv/firebase/firebase.json

  # 2. Node.js Backend-for-Frontend (BFF) Gateway
  bff-gateway:
    build:
      context: ./bff-gateway
    ports:
      - "3000:3000"
    environment:
      # Directs the Firebase Admin SDK to the local emulator
      - FIRESTORE_EMULATOR_HOST=firebase-emulator:8080
      - FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
    volumes:
      - ./bff-gateway:/app # Mounts local directory for hot-reloading
    depends_on:
      - firebase-emulator

  # 3. Python Ingestion Worker
  ingestor-service:
    build:
      context: ./ingestor-service
    ports:
      - "8000:8000"
    environment:
      # Directs the Google Cloud Python SDK to the local emulator
      - PUBSUB_EMULATOR_HOST=firebase-emulator:8085
      - GOOGLE_CLOUD_PROJECT=demo-elasstic-resume-base
    volumes:
      - ./ingestor-service:/app # Mounts local directory for hot-reloading
    depends_on:
      - firebase-emulator

```

---

## 5. Operational Workflow

This configuration standardizes the development loop.

1. **Isolated Testing:** To execute or test a single service (e.g., a Python script), developers can build and run its container independently (`docker build -t ingestor-service .`).
2. **Full Environment Initialization:** To initialize the entire infrastructure (Database, API Gateway, and Ingestion Pipeline), execute:
```bash
docker-compose up

```


3. **Development Loop:** Docker handles image compilation, port binding, and internal DNS routing. Volume mounts ensure that local code modifications trigger automatic reloads within the containers, while all network requests are securely routed to the offline emulators.
