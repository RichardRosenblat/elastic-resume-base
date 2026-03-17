# Bugle

A shared library providing a secure **Google API client** and **Google Drive permission utilities** for Elastic Resume Base microservices.

---

## Installation

```bash
npm install ../shared/Bugle
```

---

## Configuration

Bugle authenticates with Google APIs via a **Service Account** key loaded entirely from environment variables — no credential files are read from disk.

| Variable                    | Required | Description |
|-----------------------------|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_KEY`| ✅ Yes   | Raw JSON **or** Base64-encoded JSON of the Google Service Account key file. |

### Obtaining a Service Account Key

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **IAM & Admin → Service Accounts**.
3. Create or select a service account and generate a JSON key.
4. Grant the service account at least **Drive File Viewer** (`roles/drive.viewer`) on the files you need to inspect.
5. Set the key as an environment variable:

```bash
# Option A: raw JSON (escape newlines)
export GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'

# Option B: Base64-encoded (recommended for containers)
export GOOGLE_SERVICE_ACCOUNT_KEY=$(base64 -w0 path/to/key.json)
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

Provides `getGoogleAuthClient`, a factory that reads `GOOGLE_SERVICE_ACCOUNT_KEY` from the environment and returns a configured `GoogleAuth` instance.

```typescript
import { getGoogleAuthClient, DRIVE_READONLY_SCOPES } from '@elastic-resume-base/bugle';

// Use default Drive read-only scopes
const auth = getGoogleAuthClient();

// Or request custom scopes
const customAuth = getGoogleAuthClient(['https://www.googleapis.com/auth/spreadsheets']);
```

### DrivePermissionsService (`services/drive-permissions.ts`)

Uses the **Google Drive API v3** to query file permissions.

#### `getUsersWithFileAccess(fileId: string): Promise<string[]>`

Returns the email addresses of all users and groups with at least **read access** to the specified Google Drive file.

- Handles pagination automatically.
- Returns lower-cased, deduplicated email addresses.
- Includes roles: `reader`, `commenter`, `writer`, `owner`.
- Excludes `anyone` (public) and `domain`-wide permissions.

```typescript
const emails = await service.getUsersWithFileAccess(fileId);
```

#### Custom Auth Client

You can pass a pre-configured `GoogleAuth` instance if you need fine-grained control over authentication:

```typescript
import { GoogleAuth } from 'google-auth-library';
import { DrivePermissionsService } from '@elastic-resume-base/bugle';

const auth = new GoogleAuth({ keyFile: 'path/to/key.json', scopes: [...] });
const service = new DrivePermissionsService(auth);
```

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
