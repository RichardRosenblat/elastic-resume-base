import { drive as createDrive } from '@googleapis/drive';
import { getGoogleAuthClient } from '../auth.js';
/** Roles that indicate a user has at least read access to a Drive file. */
const ACCESS_ROLES = new Set(['reader', 'writer', 'commenter', 'owner']);
/** Permission types that represent individual users or groups with email addresses. */
const EMAIL_PERMISSION_TYPES = new Set(['user', 'group']);
/**
 * Extracts email addresses from a list of Drive permission objects.
 *
 * Only permissions with an `emailAddress` field and a role that grants at least
 * read access (`reader`, `commenter`, `writer`, `owner`) are included.
 *
 * @param permissions - Raw Drive API permission objects.
 * @returns Deduplicated, lower-cased array of email addresses.
 */
function extractEmailsFromPermissions(permissions) {
    const emails = new Set();
    for (const perm of permissions) {
        const { type, role, emailAddress } = perm;
        if (type != null &&
            role != null &&
            emailAddress != null &&
            EMAIL_PERMISSION_TYPES.has(type) &&
            ACCESS_ROLES.has(role)) {
            emails.add(emailAddress.toLowerCase());
        }
    }
    return [...emails];
}
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
export class DrivePermissionsService {
    _drive;
    /**
     * @param auth - Optional pre-configured {@link GoogleAuth} instance.
     *   Defaults to a Service Account client loaded from the
     *   `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable.
     */
    constructor(auth) {
        const resolvedAuth = auth ?? getGoogleAuthClient();
        this._drive = createDrive({ version: 'v3', auth: resolvedAuth });
    }
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
    async getUsersWithFileAccess(fileId) {
        const allPermissions = [];
        let pageToken;
        do {
            const response = await this._drive.permissions.list({
                fileId,
                fields: 'nextPageToken, permissions(id, type, role, emailAddress)',
                pageToken,
                // supportsAllDrives ensures Shared Drive files are also supported.
                supportsAllDrives: true,
            });
            const { permissions = [], nextPageToken } = response.data;
            allPermissions.push(...permissions);
            pageToken = nextPageToken ?? undefined;
        } while (pageToken !== undefined);
        return extractEmailsFromPermissions(allPermissions);
    }
}
//# sourceMappingURL=drive-permissions.js.map