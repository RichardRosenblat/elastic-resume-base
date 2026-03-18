import { GoogleAuth } from 'google-auth-library';
/** Required OAuth 2.0 scopes for Google Drive read access. */
export declare const DRIVE_READONLY_SCOPES: readonly ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly"];
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
export declare function getGoogleAuthClient(scopes?: readonly string[]): GoogleAuth;
//# sourceMappingURL=auth.d.ts.map