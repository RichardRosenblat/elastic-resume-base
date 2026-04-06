import { GoogleAuth } from 'google-auth-library';
/** Required OAuth 2.0 scopes for Google Drive read access. */
export const DRIVE_READONLY_SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
];
/**
 * Creates a {@link GoogleAuth} client using Application Default Credentials (ADC).
 *
 * By default, credentials are resolved automatically from the environment using ADC:
 * - Locally: via `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS`.
 * - In CI: via a service-account key file referenced by `GOOGLE_APPLICATION_CREDENTIALS`.
 * - In production (Cloud Run): via the attached service account identity.
 *
 * If you need to provide explicit credentials (e.g. in tests), pass them as the
 * second argument.
 *
 * @param scopes - OAuth 2.0 scopes to request.  Defaults to Drive read-only scopes.
 * @param credentials - Optional explicit credentials to use instead of ADC.
 * @returns An authenticated {@link GoogleAuth} instance ready to be passed to a Google API client.
 *
 * @example
 * ```typescript
 * import { getGoogleAuthClient, DRIVE_READONLY_SCOPES } from '@elastic-resume-base/bugle';
 *
 * // ADC (default) — no credentials needed at call site
 * const auth = getGoogleAuthClient(DRIVE_READONLY_SCOPES);
 * const drive = google.drive({ version: 'v3', auth });
 * ```
 */
export function getGoogleAuthClient(scopes = DRIVE_READONLY_SCOPES, credentials) {
    return new GoogleAuth({
        scopes: [...scopes],
        ...(credentials !== undefined ? { credentials } : {}),
    });
}
//# sourceMappingURL=auth.js.map