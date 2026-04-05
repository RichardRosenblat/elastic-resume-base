# ADR-013: Use Firebase Authentication with Google SSO

**Date:** 2024-01-20
**Status:** Accepted

---

## Context

All platform routes (except health probes) require authenticated access. The system needs:

- Secure identity management without the overhead of building or self-hosting an auth server
- Google SSO for enterprise convenience (the target users are recruiters/HR teams using Google Workspace)
- Email/password fallback for non-Google accounts
- Firebase ID tokens that can be verified server-side by the Gateway API
- Client-side auth state management in the React SPA

The project already uses Firebase for Firestore and Firebase Hosting, making Firebase Auth the lowest-friction identity solution in the existing GCP/Firebase ecosystem.

---

## Decision

Use **Firebase Authentication** as the identity provider, with **Google OAuth SSO** as the primary sign-in method and **email/password** as a secondary option.

- The **frontend** uses the Firebase JS SDK (`firebase/auth`) to sign in users and retrieve ID tokens. Auth state is abstracted behind the **Aegis client** package (`@elastic-resume-base/aegis/client`).
- The **Gateway API** verifies every incoming Firebase ID token using the Firebase Admin SDK. Verification is abstracted behind the **Aegis server** package (`@elastic-resume-base/aegis/server`).
- After token verification, the Gateway calls the Users API to resolve the user's role (`admin` / `user`) and `enable` status, providing application-level RBAC on top of Firebase Auth.

---

## Alternatives Considered

| Option | Reason Not Chosen |
|--------|------------------|
| **Auth0** | Additional vendor outside the GCP ecosystem; cost at scale; token format requires custom verification logic |
| **Amazon Cognito** | AWS-specific; incompatible with the GCP-first infrastructure |
| **Custom JWT / Passport.js** | High implementation and maintenance burden; credentials management risk; no Google SSO out of the box |
| **Keycloak (self-hosted)** | Infrastructure to maintain; overkill for a project that uses Firebase for everything else |

---

## Consequences

- **Easier:** Google SSO works out-of-the-box; no password hashing or session management code; Firebase emulator supports Auth locally (no cloud account needed for local dev); `firebase-admin` SDK simplifies server-side token verification.
- **Harder:** Firebase Auth is a managed service — feature set and pricing are subject to Google policy changes.
- **Follow-on decisions required:** Aegis shared library for client/server auth abstraction (→ ADR-011); application-level RBAC in Users API (→ ADR-008).
