# Bugle (TypeScript) — v2

Bugle is a shared **Google API client** library for Elastic Resume Base TypeScript microservices. It provides authenticated clients for **Google Drive**, consolidating all Google API interaction patterns into a single, well-tested package.

> **Python version:** The Python README can be found at [shared/Bugle/v2/bugle_py/README.md](../bugle_py/README.md). Both versions share the same design principles but are separate implementations.

> **v1 (legacy):** The previous version using `GOOGLE_SERVICE_ACCOUNT_KEY` is still available at [shared/Bugle/v1/bugle_ts](../../v1/bugle_ts/README.md).

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Google Drive permission queries | ✅ Bugle (`DrivePermissionsService`) |
| Authentication | ✅ ADC via `google-auth-library` |

---

## Installation

```bash
# From within any consuming TypeScript service
npm install
```

Reference from a sibling package via a `package.json` workspace or path alias pointing to the `dist/` output:

```json
{
  "dependencies": {
    "@elastic-resume-base/bugle": "file:../../shared/Bugle/v2/bugle_ts"
  }
}
```

---

## Configuration

Bugle v2 authenticates with Google APIs via **Application Default Credentials (ADC)** — no service-account key environment variables are required.

ADC resolves credentials automatically:

| Environment | How ADC resolves credentials |
|---|---|
| Local development | `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS` path |
| CI | `GOOGLE_APPLICATION_CREDENTIALS` pointing to a JSON key file |
| Production (Cloud Run) | Attached service account identity (no env vars needed) |

### Local development setup

```bash
# Option A: Use gcloud CLI
gcloud auth application-default login

# Option B: Point to a JSON key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

---

## Quick Start

```typescript
import { DrivePermissionsService } from '@elastic-resume-base/bugle';

const service = new DrivePermissionsService();

// Get all email addresses with access to a Google Sheet
const emails = await service.getUsersWithFileAccess('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
console.log(emails);
// → ['alice@example.com', 'bob@company.org']
```

---

## Modules

### Auth (`auth.ts`)

| Export | Description |
|---|---|
| `getGoogleAuthClient(scopes?, credentials?)` | Returns a `GoogleAuth` instance using ADC (or explicit credentials if provided). |
| `DRIVE_READONLY_SCOPES` | Constant array of Drive read-only OAuth 2.0 scopes. |

### DrivePermissionsService (`services/drive-permissions.ts`)

| Method | Description |
|---|---|
| `getUsersWithFileAccess(fileId)` | Returns the deduplicated, lower-cased email addresses of all users/groups with at least read access. |

---

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run lint         # Lint source and tests
npm run typecheck    # Type-check without emitting
npm test             # Run unit tests
npm run test:coverage  # Run tests with coverage report
```

---

## License

Internal — Elastic Resume Base project.
