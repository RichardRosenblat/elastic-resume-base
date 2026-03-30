# Changelog — @elastic-resume-base/bugle

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

- `getGoogleAuthClient(scopes: string[])` — returns an authenticated `OAuth2Client` using
  Application Default Credentials (ADC) or a service-account key file.
- `DRIVE_READONLY_SCOPES` constant — the minimal OAuth scopes required for read-only
  Google Drive access.
- `DrivePermissionsService` class — wraps the Google Drive API to query file permissions:
  - `getUsersWithFileAccess(fileId: string): Promise<string[]>` — returns the e-mail
    addresses of all users with direct access to the given file.
