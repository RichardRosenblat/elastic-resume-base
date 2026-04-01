# Changelog — elastic-resume-base-aegis (Python)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — 2026-04-01

### Added

- First Python release of Aegis — server-only Firebase ID token verification.
- `initialize_auth(options?)` — initialise the Firebase Admin SDK and the default
  token verifier using Application Default Credentials (ADC).
- `terminate_auth()` — tear down the Firebase Admin SDK app (useful in tests).
- `get_token_verifier()` — return the active :class:`ITokenVerifier` instance.
- `_set_token_verifier(verifier)` / `_reset_token_verifier()` — test helpers.
- `FirebaseTokenVerifier` — concrete implementation using `firebase_admin.auth`.
- `DecodedFirebaseToken` — typed dataclass with `uid`, `email`, `name`, `picture`.
- `RequestContext` — frozen dataclass providing the canonical, provider-agnostic
  representation of an authenticated server request (mirrors the TypeScript
  `RequestContext` interface in `@elastic-resume-base/aegis/server`).
- `ITokenVerifier` — `Protocol` defining the `verify_token(token) -> Any` contract.
- `AuthOptions` — dataclass for `initialize_auth` configuration (`project_id`, `credential`).
- `firebase-admin>=6.5.0` dependency.
