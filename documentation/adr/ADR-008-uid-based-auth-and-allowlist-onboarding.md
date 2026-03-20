# ADR-008: UID-Based Authentication and Allowlist-Driven User Onboarding

**Date:** 2026-03-20  
**Status:** Accepted

---

## Context

The previous authentication flow used a user's **email address** as the primary identifier throughout the system: the BFF Gateway passed the email from the decoded Firebase token to the Users API, which queried Firestore by the `email` field to look up the user's role and decide whether to grant access. This design had several problems:

- **Email is not a stable identity.** Firebase Auth allows email changes. When a user's email changes in Firebase, the Firestore document keyed by the old email no longer matches, causing access to break silently or requiring bespoke migration code.
- **Email leaks across services.** Passing an email as a path or query parameter (e.g. `GET /users/role?email=user@company.com`) exposes PII in logs, access logs, URL-encoding edge cases, and trace spans across service boundaries. The `uid` is an opaque random identifier with no PII content.
- **No controlled onboarding path.** There was no mechanism for an administrator to pre-approve a specific user (by email) before that user logs in for the first time. Similarly, there was no way to auto-provision users from a known corporate domain while requiring admin activation before they could access the system.
- **No idempotent creation.** Concurrent first-logins by the same user could race to create duplicate Firestore documents, producing non-deterministic state.
- **No email-verification enforcement.** The system accepted Firebase tokens from unverified email accounts, opening a vector for disposable or typo-squatted email addresses to gain access in production.
- **Fail-open on Users API unavailability.** If the Users API was unreachable, the BFF could surface an unhandled error, and callers could retry until they happened to land in a state where the check was bypassed.

Firebase Auth is already the authoritative identity provider for the system. Its `uid` is guaranteed to be globally unique, immutable, and PII-free. Aligning all internal identity references to `uid` removes the fragility described above.

## Decision

Firebase `uid` is adopted as the single identity reference across all services. The authentication and user-provisioning flow is redesigned as follows:

### 1. Identity anchor: `uid`

The Users collection (`users`) in Firestore is keyed by Firebase `uid` (stored as the Firestore document ID). Email is used only during the one-time onboarding decision and is never used as a lookup key in steady-state operation.

### 2. Users collection data model

Each document in the `users` collection contains:

```
uid          – Firebase uid (document ID / primary key)
email        – user's email address at time of onboarding (lowercase-normalised)
role         – "admin" | "user"
enabled      – boolean (true = active, false = provisioned but pending admin activation)
disabled     – boolean (legacy field, kept for backward compatibility; enabled takes precedence)
createdAt    – Firestore Timestamp
updatedAt    – Firestore Timestamp
```

The `enabled` field is the canonical activation flag. When reading legacy documents that only have `disabled`, the service derives `enabled = !disabled`.

### 3. Allowlist collection

A separate Firestore collection (`allowlist`, configurable via `FIRESTORE_ALLOWLIST_COLLECTION`) holds pre-approved email addresses. Each entry:

```
email  – normalised email address (document ID / primary key)
role   – optional role override to assign on onboarding (defaults to "user")
```

The allowlist is managed via three new Users API endpoints:

- `GET  /api/v1/allowlist/:email` — retrieve an entry
- `POST /api/v1/allowlist`        — create or update an entry (idempotent upsert)
- `DELETE /api/v1/allowlist/:email` — remove an entry

### 4. BFF auth hook — new step-by-step flow

```
1. Verify Firebase ID token
      → extract uid, email, email_verified
      → 401 on failure

2. Enforce email verification (production only)
      → 403 if email_verified !== true

3. Look up user by uid  →  GET /users/:uid
      ├─ found + enabled=true   → set role on request.user → ALLOW
      ├─ found + enabled=false  → 403 (account disabled)
      └─ not found              → onboarding flow (step 4)

4. Onboarding flow (runs only on first login for unknown uid)
      A. GET /allowlist/:email
            found  → POST /users { uid, email, role, enabled:true }
                      DELETE /allowlist/:email  (best-effort)
                      → ALLOW
      B. email.endsWith(ALLOWED_DOMAIN) [env var]
            match  → POST /users { uid, email, role:"user", enabled:false }
                      → 403 (pending admin activation)
      C. No match → 403

5. Users API unreachable at any step → 503 (fail-closed)
```

### 5. Idempotent user creation

`POST /users` is idempotent by `uid`: if a document with the supplied `uid` already exists (e.g. due to a concurrent first-login), the existing record is returned instead of throwing a conflict error. Email uniqueness is still enforced against other users to prevent duplicate accounts.

### 6. Bootstrap via allowlist

The `BOOTSTRAP_ADMIN_USER_EMAIL` environment variable no longer creates a Firestore user document directly on startup. Instead, it inserts the configured email into the allowlist with `role: "admin"`. On the first login by that email, the full onboarding flow provisions the admin account. This keeps the startup path purely configuration-driven and removes any direct dependency on Firestore being seeded before first use.

### 7. Fail-closed guarantee

If the Users API returns an `UnavailableError` (network error, timeout, 5xx) at any point during the auth hook, the BFF replies with HTTP 503 and denies access. Access is never granted when the authorization service cannot be reached.

## Alternatives Considered

**Keep email as the lookup key, add an email-change sync hook:**  
Email could be kept as the primary lookup key, with a Firebase Auth `onUpdate` Cloud Function that updates Firestore whenever a user changes their email. Rejected because it introduces an asynchronous, eventually-consistent sync process that creates a window of inconsistency, adds Cloud Function infrastructure, and still exposes email in internal API URLs and logs. Using `uid` eliminates the problem at the root.

**Merge allowlist into the users collection with a `pending` status:**  
Pre-approved users could be inserted into the `users` collection immediately (with a `status: "pending"`) rather than in a separate `allowlist` collection. Rejected because it conflates two distinct concerns — "users who have logged in" and "emails that are pre-approved to log in" — and makes it impossible to tell from the users collection alone whether a given entry represents a real authenticated user or a placeholder. The separate collection also allows the allowlist to be managed independently (e.g. bulk-imported) without polluting the active user roster.

**Domain allowlist only (no per-email allowlist):**  
Only the `ALLOWED_DOMAIN` rule would be supported; per-email pre-approval would be handled by the admin manually enabling the disabled domain-provisioned account. Rejected because the primary administrator (whose email may be on a different domain) needs a bootstrap path that doesn't require a pre-existing admin account to approve themselves.

**Fail-open on Users API unavailability:**  
Grant access with a default role when the Users API cannot be reached, to preserve availability during Users API downtime. Rejected because this would allow unverified or revoked accounts to access the system during outages — a security regression that could not be audited after the fact. A 503 response is the correct fail-closed behaviour; the client can retry after the outage is resolved.

**Use Firebase Custom Claims to store the role:**  
Store the user's role as a Firebase Custom Claim so that the BFF can read it directly from the decoded token without a round-trip to the Users API. Rejected because custom claims require a server-side Firebase Admin SDK call to set or update, meaning an authoritative service must still be called when a role changes. The role would also be stale in the client-held token until the token is refreshed (up to 1 hour by default), making immediate revocation impossible. Storing roles in Firestore and checking on every request is slower but authoritative and immediately consistent.

## Consequences

- **Easier:** Email changes in Firebase no longer break user access; `uid` is immutable.
- **Easier:** PII (email address) is no longer passed as a URL path or query parameter between services. Only the opaque `uid` is used after initial onboarding.
- **Easier:** The onboarding path is explicit and auditable: every user in the `users` collection got there via a controlled login event, not via direct database seeding.
- **Easier:** Concurrent first-logins for the same user are safe; idempotent creation prevents duplicate documents.
- **Easier:** The `enabled` flag allows an admin to disable a user account immediately without deleting the record.
- **Easier:** Domain-based auto-provisioning (`ALLOWED_DOMAIN`) provides a self-service signup path for known corporate domains without granting immediate access — accounts start disabled and must be activated by an admin.
- **Harder:** The BFF auth hook now makes up to three sequential calls to the Users API on a user's first login (uid lookup, allowlist check, user creation). Subsequent logins make one call (uid lookup). Latency on first login is higher but negligible in practice given that first login is a rare, one-time event per user.
- **Harder:** The `GET /api/v1/users/role?email=` endpoint (used by the old email-based flow) is no longer the primary access-check path. Callers that depended on it for role resolution should migrate to `GET /api/v1/users/:uid` and read the `role` field directly.
- **Harder:** Operators managing the allowlist must know the canonical (lowercase) email address of the user they are pre-approving, since entries are keyed by normalised email.
- **Follow-on:** The `GET /api/v1/users/role?email=` endpoint is retained for backward compatibility with the Google Drive–based (`ADMIN_SHEET_FILE_ID`) access-check path but is no longer used by the primary auth flow. It may be deprecated in a future ADR once the Drive-based path is retired.
- **Follow-on:** Existing user documents in Firestore that were created before this change may not have a `uid`-keyed document ID. A migration script is needed if those documents must be preserved; otherwise, the first login for each existing user will go through the onboarding flow and create a new, correctly-keyed document.
- **Follow-on:** The `enabled` field should be surfaced in admin tooling so that administrators can activate domain-provisioned accounts. See the Users API `PATCH /api/v1/users/:uid` endpoint.
