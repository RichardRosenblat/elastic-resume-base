# ADR-008: Overhaul Login & Authorization Flow with Firestore-Native RBAC

**Date:** 2026-03-21  
**Status:** Accepted

---

## Context

The previous authentication and authorization system had several shortcomings:

- **Fragmented user identity**: User roles were backed by Google Drive permissions (via the Bugle library), making them dependent on a Google Drive file and a service account. This created an external dependency that was costly to manage, hard to test, and tightly coupled to Google Workspace.
- **No enable/disable control**: There was no first-class way to disable a user's access without removing them from the underlying identity provider. Administrators could not put accounts on hold pending approval.
- **Opaque onboarding**: New users who logged in for the first time with a valid Firebase token would receive access or denial based solely on Drive file membership — there was no structured onboarding flow for bringing new users into the system.
- **Logic scattered across services**: Authorization checks were partially performed in the Gateway and partially in the Users API, creating inconsistencies and making the system harder to reason about.
- **No admin bootstrapping**: There was no automated mechanism to ensure an initial admin existed, requiring manual intervention to configure the first administrator.

## Decision

We replaced the Drive-backed authorization model with a fully Firestore-native, role-based access control (RBAC) system. The key design choices are:

### 1. Two-collection user model

Two Firestore collections manage user lifecycle:

| Collection | Purpose |
|---|---|
| `users` | Active user records with `uid`, `email`, `role`, and `enable` fields |
| `pre_approved_users` | Pending user approvals with `email` and `role` fields |

Users move through a well-defined lifecycle:
1. **Pre-approved** → email is in `pre_approved_users` (placed there by an admin or admin bootstrap)
2. **Active** → when the user first logs in, the pre-approved record is promoted to `users` with `enable=true`
3. **Domain-onboarded** → users from configured `ONBOARDABLE_EMAIL_DOMAINS` are auto-registered in `users` with `enable=false`, pending admin approval
4. **Blocked** → users from none of the above receive a `403 Forbidden` immediately

### 2. Centralized authorization in the Users API

A single unauthenticated endpoint `POST /api/v1/users/authorize` encapsulates the entire authorization decision:

```
uid + email
  → users/{uid} exists?             → return {role, enable}
  → pre_approved_users/{email}?     → promote to users (enable=true), delete pre-approval
  → email domain in ONBOARDABLE?    → create users/{uid} (enable=false)
  → 403 Forbidden
```

All Users API routes interact exclusively with the `users` and `pre_approved_users` collections, ensuring a single point of truth for user data.

### 3. Gateway as the sole authentication gateway

The Gateway validates Firebase ID tokens and calls the Users API's `/authorize` endpoint. All authorization decisions flow through this path:

1. **Token validation**: Gateway verifies the Firebase JWT and extracts `uid` and `email`.
2. **Authorization query**: Gateway calls `POST /api/v1/users/authorize` with `{uid, email}`.
3. **Enable check**: If `enable=false`, Gateway returns `403` with a "pending approval" message.
4. **RBAC enforcement**: Gateway checks `role` against the required permissions for the route.

### 4. Role-based access control

Two roles are defined:

| Role | Access |
|---|---|
| `admin` | All routes, including user management and pre-approval management |
| `user` | All routes except admin-only routes |

Admin-only operations in the Gateway are guarded by the `requireAdminHook` pre-handler.

### 5. Admin bootstrapping

During Users API startup, if a `BOOTSTRAP_ADMIN_USER_EMAIL` environment variable is set:
- If the email already exists in `users` or `pre_approved_users` → skip (idempotent)
- Otherwise → add the email to `pre_approved_users` with `role: 'admin'`

This ensures there is always at least one admin available without manual intervention.

### 6. Persistence abstraction via Synapse

Direct Firestore access was removed from all services. Both the `users` and `pre_approved_users` collections are accessed exclusively through the Synapse shared library, which exposes two interfaces:

- `IUserDocumentStore` — CRUD + filtered listing for user documents
- `IPreApprovedStore` — CRUD + filtered listing for pre-approved user documents

Concrete implementations (`FirestoreUserDocumentStore`, `FirestorePreApprovedStore`) are in Synapse. Services depend only on the interfaces, making them testable without a real Firestore and adaptable to different persistence backends.

### 7. Query filtering

Both `/api/v1/users` and `/api/v1/users/pre-approve` list endpoints support query-parameter filters (`role`, `enable`, `filterRole`) to allow efficient retrieval of user subsets without client-side filtering.

## Alternatives Considered

**Keep Drive-backed roles:** Rejected because it creates an operational dependency on Google Drive and a service account key, complicates local development, and is not portable to non-Google environments.

**Use Firebase Auth custom claims for roles:** Rejected because custom claims require the Firebase Admin SDK to be called on every role change, have a propagation delay (JWT caching), and are opaque to the Firestore data model. Storing roles in Firestore is simpler, immediately consistent, and more auditable.

**Embed authorization logic in the Gateway:** Rejected because it would duplicate Firestore access in a service that should be a routing layer, not a data layer. Centralizing in the Users API maintains the principle of single responsibility and ensures the Gateway is not directly coupled to persistence.

## Consequences

- **Easier:** Administrators can pre-approve users before they log in, or approve users from auto-onboarded domains after they appear.
- **Easier:** Disabling a user is a single field update (`enable: false`) with immediate effect.
- **Easier:** The authorization flow is fully testable without Firebase Auth or Google Drive.
- **Easier:** Role changes are immediately visible — no JWT cache propagation delay.
- **Easier:** Admin bootstrapping is fully automated and idempotent.
- **Harder:** Two Firestore collections must be kept consistent (handled by the Users API exclusively).
- **Harder:** The `BOOTSTRAP_ADMIN_USER_EMAIL` must be set for the first deployment; without it, there is no way to create the first admin through the UI.
- **Follow-on:** Future work may add audit logging for role changes and enable/disable events to improve security observability.
