# ADR-001: Use a Monorepo Structure

**Date:** 2024-01-01  
**Status:** Accepted

---

## Context

The project is composed of multiple Node.js and Python microservices (Gateway, Users API, Ingestor, AI Worker, Search Base, File Generator, Document Reader, DLQ Notifier) that share:

- A common configuration file (`config.yaml`)
- Internal TypeScript packages (`Synapse`, `Bowltie`, `Bugle`, `Toolbox`) under `shared/`
- A single Docker Compose environment for local development
- Firebase Emulator configuration

Managing these across separate repositories would require cross-repo dependency versioning, complex CI coordination, and duplicated configuration.

## Decision

All microservices, shared libraries, and configuration live in a single repository (monorepo).

## Alternatives Considered

**Polyrepo (one repository per service):** Each microservice has its own repository. Shared libraries are published to a private npm/PyPI registry and consumed as versioned packages.

This was rejected because:
- The project is early-stage; the overhead of versioning and publishing internal packages outweighs the benefits.
- Local development requires spinning up many services simultaneously — a monorepo with a single `docker-compose.yml` is far simpler.
- Shared library changes would require separate PRs and version bumps in every consuming service.

## Consequences

- **Easier:** Shared library changes are immediately visible to all consumers; no version bumps required.
- **Easier:** A single `docker-compose.yml` and `config.yaml` covers the entire local development environment.
- **Easier:** Cross-service refactors can be made atomically in a single PR.
- **Harder:** CI must implement selective builds — only rebuild and test services whose source files changed.
- **Harder:** The repository grows large over time; tooling (e.g., sparse checkout) may be needed for contributors who only work on a subset of services.
- **Follow-on:** Build scripts (`build_shared.bat` / `build_shared.sh`) are needed to compile shared TypeScript libraries before services that depend on them can run. See [Monorepo Scripts](../monorepo-scripts.md).
