import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';


/** Zod schema for the environment variables required to authenticate with Google APIs. */
const serviceAccountEnvSchema = z.object({
  /** Base64-encoded or raw JSON string of the Google Service Account key file. */
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().min(1, 'GOOGLE_SERVICE_ACCOUNT_KEY is required'),
});

/** Required OAuth 2.0 scopes for Google Drive read access. */
export const DRIVE_READONLY_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
] as const;


/**
 * Parses the raw service-account key material from the environment.
 *
 * The key may be provided as:
 * - A raw JSON string.
 * - A Base64-encoded JSON string (useful for container environment variables).
 *
 * @returns The parsed service account credentials object.
 * @throws {Error} If `GOOGLE_SERVICE_ACCOUNT_KEY` is missing or cannot be parsed.
 */
function parseServiceAccountKey(): Record<string, unknown> {
  const { GOOGLE_SERVICE_ACCOUNT_KEY } = serviceAccountEnvSchema.parse(process.env);

  let raw = GOOGLE_SERVICE_ACCOUNT_KEY.trim();

  // Attempt Base64 decode; fall back to treating the value as plain JSON.
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    // Only use the decoded string if it looks like JSON (starts with '{').
    if (decoded.trimStart().startsWith('{')) {
      raw = decoded;
    }
  } catch {
    // Not Base64 — use raw value as-is.
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      'Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: value must be a valid JSON object ' +
        '(raw or Base64-encoded).',
    );
  }
}


/**
 * Creates a {@link GoogleAuth} client authenticated with a Service Account.
 *
 * Credentials are loaded exclusively from the `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable
 * — no credential files are read from disk.
 *
 * @param scopes - OAuth 2.0 scopes to request.  Defaults to Drive read-only scopes.
 * @returns An authenticated {@link GoogleAuth} instance ready to be passed to a Google API client.
 *
 * @example
 * ```typescript
 * import { getGoogleAuthClient, DRIVE_READONLY_SCOPES } from '@elastic-resume-base/bugle';
 *
 * const auth = getGoogleAuthClient(DRIVE_READONLY_SCOPES);
 * const drive = google.drive({ version: 'v3', auth });
 * ```
 */
export function getGoogleAuthClient(
  scopes: readonly string[] = DRIVE_READONLY_SCOPES,
): GoogleAuth {
  const credentials = parseServiceAccountKey();

  return new GoogleAuth({
    credentials,
    scopes: [...scopes],
  });
}
