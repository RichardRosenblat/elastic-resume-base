# Changelog — elastic-resume-base-harbor v2 (Python)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — 2026-04-01

### Added

- `IamHarborClient` — async HTTP client that automatically attaches a Google Cloud OIDC
  identity token to every outgoing request, enabling IAM-based service-to-service
  authentication for Cloud Run.
- `IamHarborClientOptions` — dataclass extending `HarborClientOptions` with a required
  `audience: str` field (the OIDC audience, typically the receiving service's HTTPS URL).
- `create_iam_harbor_client(base_url, audience, timeout_seconds, default_headers)` —
  factory function for creating an `IamHarborClient`.
- `google-auth>=2.29.0` dependency for OIDC identity token acquisition.

### Changed

- Package version bumped to `2.0.0`.
- All v1 exports (`HarborClient`, `HarborClientOptions`, `create_harbor_client`,
  `is_harbor_error`) remain available unchanged from `harbor_py`.

---

## [1.0.0] — 2024-01-01 (v1 reference)

See [v1 CHANGELOG](../../v1/harbor_py/CHANGELOG.md) for the original v1 release history.
