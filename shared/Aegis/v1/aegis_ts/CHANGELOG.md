# Changelog — @elastic-resume-base/aegis

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

- `initializeAuth(options: AuthOptions)` — initialises the authentication provider once at
  application startup; must be called before any token is verified.
- `getTokenVerifier()` — returns the singleton `ITokenVerifier` instance after
  `initializeAuth` has been called.
- `ITokenVerifier` interface — abstraction over any token-verification back-end.
- `DecodedToken` type — shape of the payload returned by a successful verification.
- `AuthOptions` type — configuration accepted by `initializeAuth`.
- `FirebaseTokenVerifier` class — concrete `ITokenVerifier` that verifies Firebase ID
  tokens using `firebase-admin`.
- `FirebaseAuthOptions` type — Firebase-specific configuration (project ID, credential).
- Client-side helpers exported from the `./client` sub-path entry point:
  - `IClientAuth` interface
  - `getClientAuth()` — returns the Firebase client-auth singleton.
  - `initializeClientAuth(options)` — initialises the Firebase client SDK.
  - `ClientAuthOptions` type
