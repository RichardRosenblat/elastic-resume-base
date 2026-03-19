# ADR-002: Use a Backend-for-Frontend (BFF) Gateway

**Date:** 2024-01-01  
**Status:** Accepted

---

## Context

The frontend SPA needs to communicate with several independent microservices (Ingestor, Search Base, File Generator, Document Reader). Without a gateway layer:

- The frontend would need to know the URL of every downstream service, exposing internal service topology to the browser.
- Each service would need to independently validate Firebase Auth JWTs, duplicating authentication logic.
- CORS headers would need to be configured on every service.
- Rate limiting and request logging would be fragmented across services.

## Decision

All client requests go through a single Node.js BFF Gateway (Fastify v5) that authenticates the caller and routes requests to the appropriate downstream microservice. The gateway is the only service directly reachable from the public internet.

## Alternatives Considered

**Direct frontend-to-microservice calls:** The SPA calls each service directly. Rejected because it exposes service topology, complicates auth, and makes CORS management per-service.

**API Gateway managed service (e.g., Google Cloud API Gateway, Kong):** A managed gateway handles routing and auth. Rejected because it adds operational overhead, cost, and an additional system to learn. A custom Node.js gateway integrates more naturally with Firebase Admin SDK and provides full control over request shaping.

## Consequences

- **Easier:** Centralized authentication — the gateway validates Firebase Auth JWTs once; downstream services trust the caller.
- **Easier:** Centralized rate limiting and CORS configuration.
- **Easier:** Correlation IDs and request logging can be injected uniformly for all downstream calls.
- **Harder:** The gateway is a single point of failure; its availability is critical.
- **Harder:** Every new microservice endpoint requires a corresponding route in the gateway.
- **Follow-on:** The gateway adds one network hop to every request. The impact is negligible for Cloud Run services in the same region, but should be monitored.
