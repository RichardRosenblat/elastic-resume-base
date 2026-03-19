# ADR-004: Use Firestore as the Primary Database

**Date:** 2024-01-01  
**Status:** Accepted

---

## Context

The system needs a database to store:

- User profiles and roles (managed by Users API)
- Raw resume text (written by Ingestor)
- Structured resume JSON and embedding metadata (written by AI Worker)
- Translation cache entries (written by File Generator)

The system runs entirely on GCP and must meet the following constraints:

- Serverless / auto-scaling — no persistent VM or database instance to manage
- Integrates with Firebase Authentication for user identity
- Generous free tier for low-volume usage
- Document-oriented data model (user profiles, resume JSON objects map naturally to documents)

A persistence abstraction layer (`Synapse` / `UserRepository` interface) is used in the Node.js services to avoid direct Firestore coupling in business logic, enabling future database swaps without touching service code.

## Decision

Firestore (Native mode) is the primary data store for all persistent application data. All PII fields are encrypted with Cloud KMS before storage. The `Synapse` shared library provides the `UserRepository` interface and its `FirestoreUserRepository` implementation.

## Alternatives Considered

**Cloud SQL (PostgreSQL):** Familiar SQL semantics with joins and transactions. Rejected because it requires a persistent Cloud SQL instance (minimum ~$7/month), does not integrate as naturally with Firebase Auth, and the relational schema adds complexity for the document-oriented resume data model.

**MongoDB Atlas:** Flexible document model, similar to Firestore. Rejected because it is not a GCP-native service — it adds an external dependency, separate billing, and more complex network configuration (VPC peering or public endpoint).

## Consequences

- **Easier:** Serverless, auto-scaling, no instance management required.
- **Easier:** Native Firebase Auth integration — user UIDs are used directly as Firestore document IDs.
- **Easier:** The `Synapse` abstraction (`UserRepository` interface + `FirestoreUserRepository` implementation) means business logic is never coupled to Firestore directly.
- **Harder:** No SQL joins — related data must be denormalized or fetched with multiple round-trips.
- **Harder:** PII fields must be encrypted before write and decrypted after read using Cloud KMS, adding latency and complexity to every PII operation.
- **Follow-on:** The Firestore emulator must be running locally for development and tests. It is provided via the `firebase-emulator` Docker container.
