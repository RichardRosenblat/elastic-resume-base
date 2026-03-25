import type { GoogleAuth } from 'google-auth-library';
/**
 * Service for querying Google Drive file permissions.
 *
 * Uses the **Google Drive API v3** (not the Sheets API) to retrieve permission
 * information for individual files.
 *
 * @example
 * ```typescript
 * import { DrivePermissionsService } from '@elastic-resume-base/bugle';
 *
 * const service = new DrivePermissionsService();
 * const emails = await service.getUsersWithFileAccess('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
 * // → ['alice@example.com', 'bob@company.org']
 * ```
 */
export declare class DrivePermissionsService {
    private readonly _drive;
    /**
     * @param auth - Optional pre-configured {@link GoogleAuth} instance.
     *   Defaults to a Service Account client loaded from the
     *   `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable.
     */
    constructor(auth?: GoogleAuth);
    /**
     * Returns the email addresses of all users and groups that have been granted
     * at least **read access** to the specified Google Drive file.
     *
     * The method handles pagination automatically — all permission pages are
     * fetched before returning.
     *
     * @param fileId - The Google Drive file ID (e.g. the ID of a Google Sheet).
     * @returns An array of email addresses (lower-cased, deduplicated) with
     *   `reader`, `commenter`, `writer`, or `owner` access to the file.
     *   Returns an empty array if no individual users or groups have explicit
     *   access (e.g. the file is accessible only via a public link).
     *
     * @throws {Error} If the Drive API call fails (e.g. insufficient scopes,
     *   the service account lacks access to the file, or the file does not exist).
     *
     * @example
     * ```typescript
     * const emails = await service.getUsersWithFileAccess('1BxiMVs0XRA5nFMd...');
     * console.log(emails); // ['alice@example.com', 'bob@org.com']
     * ```
     */
    getUsersWithFileAccess(fileId: string): Promise<string[]>;
}
//# sourceMappingURL=drive-permissions.d.ts.map