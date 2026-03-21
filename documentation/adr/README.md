# Architecture Decision Records (ADRs)

This directory contains the Architecture Decision Records (ADRs) for the Elastic Resume Base project.

---

## What is an ADR?

An Architecture Decision Record is a short document that captures a significant architectural decision made during the course of the project. Each ADR records:

- **The decision** — what was decided
- **The context** — why the decision was needed, what constraints were in play
- **The alternatives considered** — what other options were evaluated
- **The consequences** — what becomes easier or harder as a result

ADRs are immutable once accepted. If a decision is reversed or superseded, a new ADR is created that explicitly references and supersedes the old one.

---

## How to Use These Documents

- **Before making a significant architectural change**, check whether an existing ADR covers the area you are working in.
- **When proposing a new architectural decision**, create a new ADR following the template below and include it in your PR.
- **When reviewing a PR that includes an ADR**, ensure that the decision is well-justified, alternatives are adequately considered, and consequences are clearly outlined.

---

## ADR Template

```markdown
# ADR-XXX: <Title>

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-YYY

---

## Context

<Why is this decision needed? What constraints, requirements, or forces are in play?>

## Decision

<What was decided?>

## Alternatives Considered

<What other options were evaluated and why were they not chosen?>

## Consequences

<What becomes easier? What becomes harder? What follow-on decisions are required?>
```

---

## Index

| ADR | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-monorepo-structure.md) | Use a Monorepo Structure | Accepted |
| [ADR-002](ADR-002-bff-gateway-pattern.md) | Use a Backend-for-Frontend (BFF) Gateway | Accepted |
| [ADR-003](ADR-003-pubsub-async-messaging.md) | Use Cloud Pub/Sub for Inter-Service Messaging | Accepted |
| [ADR-004](ADR-004-firestore-database.md) | Use Firestore as the Primary Database | Accepted |
| [ADR-005](ADR-005-faiss-vector-search.md) | Use FAISS for Vector Similarity Search | Accepted |
| [ADR-006](ADR-006-nodejs-for-gateway-python-for-workers.md) | Use Node.js for Gateway Services, Python for AI/Data Workers | Accepted |
| [ADR-007](ADR-007-no-object-storage-text-only-persistence.md) | No Object Storage — Text-Only File Persistence | Accepted |
| [ADR-008](ADR-008-auth-and-authorization-flow-overhaul.md) | Overhaul Login & Authorization Flow with Firestore-Native RBAC | Accepted |