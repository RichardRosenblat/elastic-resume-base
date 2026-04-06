/**
 * @module @elastic-resume-base/bugle
 *
 * Bugle provides a Google API client and Drive permission utilities
 * for Elastic Resume Base microservices.
 *
 * Authentication is handled via **Application Default Credentials (ADC)** —
 * no service-account key environment variables are required.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { DrivePermissionsService } from '@elastic-resume-base/bugle';
 *
 * const service = new DrivePermissionsService();
 * const emails = await service.getUsersWithFileAccess('<FILE_ID>');
 * ```
 */
export { getGoogleAuthClient, DRIVE_READONLY_SCOPES } from './auth.js';
export { DrivePermissionsService } from './services/drive-permissions.js';
//# sourceMappingURL=index.d.ts.map