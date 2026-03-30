/**
 * Unit tests for DrivePermissionsService.getUsersWithFileAccess.
 *
 * The `@googleapis/drive` module and the `auth` module are fully mocked so no real
 * Google credentials or network calls are needed.
 */

jest.mock('@googleapis/drive', () => ({
  drive: jest.fn(),
}));

jest.mock('../../src/auth', () => ({
  getGoogleAuthClient: jest.fn().mockReturnValue({}),
  DRIVE_READONLY_SCOPES: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
}));

import * as driveModule from '@googleapis/drive';
import { DrivePermissionsService } from '../../src/services/drive-permissions.js';

/** Minimal Drive Permission shape used across tests. */
function makePermission(
  overrides: Partial<{
    type: string;
    role: string;
    emailAddress: string;
    id: string;
  }> = {},
) {
  return {
    id: 'perm-001',
    type: 'user',
    role: 'reader',
    emailAddress: 'user@example.com',
    ...overrides,
  };
}

/** Creates a mock `permissions.list` function that returns the given responses in order. */
function mockPermissionsList(pages: Array<{ permissions: ReturnType<typeof makePermission>[]; nextPageToken?: string }>) {
  const mockFn = jest.fn();
  for (const page of pages) {
    mockFn.mockResolvedValueOnce({ data: page });
  }
  return mockFn;
}

/** Builds a DrivePermissionsService with a mocked Drive permissions.list. */
function buildService(
  listFn: jest.Mock,
): DrivePermissionsService {
  (driveModule.drive as jest.Mock).mockReturnValue({
    permissions: { list: listFn },
  });
  return new DrivePermissionsService();
}

describe('DrivePermissionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsersWithFileAccess', () => {
    it('returns email addresses of users with read access', async () => {
      const listFn = mockPermissionsList([
        {
          permissions: [
            makePermission({ emailAddress: 'Alice@Example.com', role: 'reader' }),
            makePermission({ emailAddress: 'bob@example.com', role: 'writer' }),
          ],
        },
      ]);
      const service = buildService(listFn);

      const result = await service.getUsersWithFileAccess('file-id-123');

      expect(result).toEqual(expect.arrayContaining(['alice@example.com', 'bob@example.com']));
      expect(result).toHaveLength(2);
    });

    it('lowercases all returned email addresses', async () => {
      const listFn = mockPermissionsList([
        { permissions: [makePermission({ emailAddress: 'UPPER@EXAMPLE.COM', role: 'owner' })] },
      ]);
      const service = buildService(listFn);

      const result = await service.getUsersWithFileAccess('file-id');

      expect(result).toContain('upper@example.com');
    });

    it('deduplicates email addresses that appear in multiple permissions', async () => {
      const listFn = mockPermissionsList([
        {
          permissions: [
            makePermission({ emailAddress: 'alice@example.com', role: 'reader' }),
            makePermission({ emailAddress: 'Alice@Example.com', role: 'writer' }),
          ],
        },
      ]);
      const service = buildService(listFn);

      const result = await service.getUsersWithFileAccess('file-id');

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('alice@example.com');
    });

    it('handles pagination by fetching all pages', async () => {
      const listFn = mockPermissionsList([
        {
          permissions: [makePermission({ emailAddress: 'page1@example.com' })],
          nextPageToken: 'token-1',
        },
        {
          permissions: [makePermission({ emailAddress: 'page2@example.com' })],
        },
      ]);
      const service = buildService(listFn);

      const result = await service.getUsersWithFileAccess('file-id');

      expect(result).toHaveLength(2);
      expect(result).toContain('page1@example.com');
      expect(result).toContain('page2@example.com');
      expect(listFn).toHaveBeenCalledTimes(2);
    });

    it('returns an empty array when the file has no individual user permissions', async () => {
      const listFn = mockPermissionsList([{ permissions: [] }]);
      const service = buildService(listFn);

      const result = await service.getUsersWithFileAccess('file-id');

      expect(result).toEqual([]);
    });

    it('excludes "anyone" and "domain" permission types', async () => {
      const listFn = mockPermissionsList([
        {
          permissions: [
            makePermission({ type: 'anyone', role: 'reader', emailAddress: undefined }),
            makePermission({ type: 'domain', role: 'reader', emailAddress: undefined }),
            makePermission({ emailAddress: 'real-user@example.com', role: 'reader' }),
          ],
        },
      ]);
      const service = buildService(listFn);

      const result = await service.getUsersWithFileAccess('file-id');

      expect(result).toEqual(['real-user@example.com']);
    });

    it('excludes permissions with roles that do not grant read access', async () => {
      const listFn = mockPermissionsList([
        {
          permissions: [
            makePermission({ emailAddress: 'pending@example.com', role: 'pendingOwner' }),
          ],
        },
      ]);
      const service = buildService(listFn);

      const result = await service.getUsersWithFileAccess('file-id');

      expect(result).toEqual([]);
    });

    it('includes group permissions', async () => {
      const listFn = mockPermissionsList([
        {
          permissions: [
            makePermission({ type: 'group', emailAddress: 'team@example.com', role: 'reader' }),
          ],
        },
      ]);
      const service = buildService(listFn);

      const result = await service.getUsersWithFileAccess('file-id');

      expect(result).toContain('team@example.com');
    });

    it('passes the fileId to the Drive API call', async () => {
      const listFn = mockPermissionsList([{ permissions: [] }]);
      const service = buildService(listFn);

      await service.getUsersWithFileAccess('my-specific-file-id');

      expect(listFn).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: 'my-specific-file-id' }),
      );
    });

    it('propagates Drive API errors to the caller', async () => {
      const listFn = jest.fn().mockRejectedValue(new Error('Insufficient permissions'));
      const service = buildService(listFn);

      await expect(service.getUsersWithFileAccess('file-id')).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });
});
