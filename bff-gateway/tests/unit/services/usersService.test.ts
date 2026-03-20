/**
 * Unit tests for usersService RBAC logic, email domain validation,
 * and UserAPI role integration.
 */

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({}),
  auth: jest.fn(),
}));

jest.mock('../../../src/services/userApiClient', () => ({
  getUserRoleByEmail: jest.fn(),
  getUserRolesBatch: jest.fn(),
}));

jest.mock('../../../src/middleware/auth', () => ({
  getFirebaseApp: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../src/config', () => ({
  config: {
    allowedEmailDomains: '',
    userApiServiceUrl: 'http://localhost:8005',
    requestTimeoutMs: 30000,
    nodeEnv: 'test',
    gcpProjectId: 'demo-project',
    port: 3000,
    logLevel: 'silent',
    projectId: 'demo',
    allowedOrigins: 'http://localhost:3000',
    downloaderServiceUrl: 'http://localhost:8001',
    searchBaseServiceUrl: 'http://localhost:8002',
    fileGeneratorServiceUrl: 'http://localhost:8003',
    documentReaderServiceUrl: 'http://localhost:8004',
  },
}));

import * as admin from 'firebase-admin';
import * as userApiClient from '../../../src/services/userApiClient.js';
import { config } from '../../../src/config.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../src/errors.js';
import {
  createUser,
  getUserByUid,
  updateUser,
  deleteUser,
  listUsers,
} from '../../../src/services/usersService.js';

/** Minimal Firebase UserRecord shape used across tests. */
const makeFirebaseRecord = (overrides: Partial<admin.auth.UserRecord> = {}): admin.auth.UserRecord =>
  ({
    uid: 'uid123',
    email: 'user@example.com',
    displayName: 'Test User',
    photoURL: undefined,
    disabled: false,
    emailVerified: false,
    metadata: {
      creationTime: '2024-01-01T00:00:00.000Z',
      lastSignInTime: '2024-01-02T00:00:00.000Z',
      toJSON: () => ({}),
    },
    providerData: [],
    toJSON: () => ({}),
    ...overrides,
  }) as unknown as admin.auth.UserRecord;

describe('usersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset allowed domains to empty (no restrictions) for most tests
    (config as Record<string, unknown>)['allowedEmailDomains'] = '';
  });

  // ---------------------------------------------------------------------------
  // createUser
  // ---------------------------------------------------------------------------
  describe('createUser', () => {
    it('throws ForbiddenError when requester is not admin', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValue('user');

      await expect(
        createUser({ email: 'new@example.com', password: 'pass123' }, 'non-admin-uid'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('creates user and returns record with role when requester is admin', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock)
        .mockResolvedValueOnce('admin') // requester role check
        .mockResolvedValueOnce('user'); // new user's role
      (admin.auth as jest.Mock).mockReturnValue({
        createUser: jest.fn().mockResolvedValue(makeFirebaseRecord()),
      });

      const result = await createUser({ email: 'new@example.com', password: 'pass123' }, 'admin-uid');

      expect(result.uid).toBe('uid123');
      expect(result.role).toBe('user');
    });

    it('throws ValidationError when email domain is disallowed', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValue('admin');
      (config as Record<string, unknown>)['allowedEmailDomains'] = 'allowed.com';

      await expect(
        createUser({ email: 'user@blocked.com', password: 'pass123' }, 'admin-uid'),
      ).rejects.toThrow(ValidationError);
    });

    it('succeeds when email domain is in the allowed list', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock)
        .mockResolvedValueOnce('admin')
        .mockResolvedValueOnce('user');
      (admin.auth as jest.Mock).mockReturnValue({
        createUser: jest.fn().mockResolvedValue(makeFirebaseRecord({ email: 'user@allowed.com' })),
      });
      (config as Record<string, unknown>)['allowedEmailDomains'] = 'allowed.com';

      const result = await createUser({ email: 'user@allowed.com', password: 'pass123' }, 'admin-uid');

      expect(result.email).toBe('user@allowed.com');
    });
  });

  // ---------------------------------------------------------------------------
  // getUserByUid
  // ---------------------------------------------------------------------------
  describe('getUserByUid', () => {
    it('returns user for any authenticated requester', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValueOnce('user');
      (admin.auth as jest.Mock).mockReturnValue({
        getUser: jest.fn().mockResolvedValue(makeFirebaseRecord()),
      });

      const result = await getUserByUid('uid123');
      expect(result.uid).toBe('uid123');
    });

    it('returns another user when requester is not admin', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValueOnce('user');
      (admin.auth as jest.Mock).mockReturnValue({
        getUser: jest.fn().mockResolvedValue(makeFirebaseRecord({ uid: 'other-uid' })),
      });

      const result = await getUserByUid('other-uid');
      expect(result.uid).toBe('other-uid');
    });

    it('throws NotFoundError when Firebase user does not exist', async () => {
      (admin.auth as jest.Mock).mockReturnValue({
        getUser: jest.fn().mockRejectedValue(new Error('There is no user record corresponding to uid')),
      });

      await expect(getUserByUid('missing-uid')).rejects.toThrow(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // updateUser
  // ---------------------------------------------------------------------------
  describe('updateUser', () => {
    it('allows admin to update any user with all fields', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock)
        .mockResolvedValueOnce('admin') // requester
        .mockResolvedValueOnce('user'); // target after update
      (admin.auth as jest.Mock).mockReturnValue({
        updateUser: jest.fn().mockResolvedValue(makeFirebaseRecord()),
      });

      const result = await updateUser('uid123', { displayName: 'New Name', disabled: true }, 'admin@example.com');
      expect(result.uid).toBe('uid123');

      // Verify that the admin payload including 'disabled' was forwarded to Firebase
      const adminAuthMock = (admin.auth as jest.Mock).mock.results[0]?.value as {
        updateUser: jest.Mock;
      };
      expect(adminAuthMock.updateUser).toHaveBeenCalledWith('uid123', { displayName: 'New Name', disabled: true });
    });

    it('allows non-admin to update their own displayName and photoURL', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock)
        .mockResolvedValueOnce('user') // requester
        .mockResolvedValueOnce('user'); // target after update
      (admin.auth as jest.Mock).mockReturnValue({
        getUser: jest.fn().mockResolvedValue(makeFirebaseRecord({ email: 'user@example.com' })),
        updateUser: jest.fn().mockResolvedValue(makeFirebaseRecord()),
      });

      await updateUser('uid123', { displayName: 'New Name', photoURL: 'https://img.example.com/photo.jpg' }, 'user@example.com');

      const authMock = (admin.auth as jest.Mock).mock.results[0]?.value as { updateUser: jest.Mock };
      // Non-admin update must NOT include sensitive fields
      expect(authMock.updateUser).toHaveBeenCalledWith('uid123', {
        displayName: 'New Name',
        photoURL: 'https://img.example.com/photo.jpg',
      });
    });

    it('strips sensitive fields (password, email, disabled) from non-admin self-update', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock)
        .mockResolvedValueOnce('user')
        .mockResolvedValueOnce('user');
      (admin.auth as jest.Mock).mockReturnValue({
        getUser: jest.fn().mockResolvedValue(makeFirebaseRecord({ email: 'user@example.com' })),
        updateUser: jest.fn().mockResolvedValue(makeFirebaseRecord()),
      });

      await updateUser(
        'uid123',
        { displayName: 'Safe', email: 'hacker@evil.com', password: 'newpass', disabled: false },
        'user@example.com',
      );

      const authMock = (admin.auth as jest.Mock).mock.results[0]?.value as { updateUser: jest.Mock };
      const callArgs = authMock.updateUser.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty('email');
      expect(callArgs).not.toHaveProperty('password');
      expect(callArgs).not.toHaveProperty('disabled');
      expect(callArgs).toHaveProperty('displayName', 'Safe');
    });

    it('throws ForbiddenError when non-admin tries to update another user', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValue('user');
      (admin.auth as jest.Mock).mockReturnValue({
        getUser: jest.fn().mockResolvedValue(makeFirebaseRecord({ email: 'other@example.com' })),
      });

      await expect(
        updateUser('other-uid', { displayName: 'Hacked' }, 'self@example.com'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ValidationError when admin sets a disallowed email domain', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValue('admin');
      (config as Record<string, unknown>)['allowedEmailDomains'] = 'company.com';

      await expect(
        updateUser('uid123', { email: 'user@blocked.org' }, 'admin@company.com'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError when Firebase user does not exist', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock)
        .mockResolvedValueOnce('admin');
      (admin.auth as jest.Mock).mockReturnValue({
        updateUser: jest.fn().mockRejectedValue(new Error('There is no user record corresponding to uid')),
      });

      await expect(updateUser('missing-uid', { displayName: 'Name' }, 'admin@company.com')).rejects.toThrow(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteUser
  // ---------------------------------------------------------------------------
  describe('deleteUser', () => {
    it('throws ForbiddenError when requester is not admin', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValue('user');

      await expect(deleteUser('uid123', 'non-admin-uid')).rejects.toThrow(ForbiddenError);
    });

    it('deletes user when requester is admin', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValue('admin');
      const deleteMock = jest.fn().mockResolvedValue(undefined);
      (admin.auth as jest.Mock).mockReturnValue({ deleteUser: deleteMock });

      await deleteUser('uid123', 'admin-uid');
      expect(deleteMock).toHaveBeenCalledWith('uid123');
    });

    it('throws NotFoundError when Firebase user does not exist', async () => {
      (userApiClient.getUserRoleByEmail as jest.Mock).mockResolvedValue('admin');
      (admin.auth as jest.Mock).mockReturnValue({
        deleteUser: jest.fn().mockRejectedValue(new Error('There is no user record corresponding to uid')),
      });

      await expect(deleteUser('missing-uid', 'admin-uid')).rejects.toThrow(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // listUsers
  // ---------------------------------------------------------------------------
  describe('listUsers', () => {
    it('returns users with roles attached for any authenticated user', async () => {
      (userApiClient.getUserRolesBatch as jest.Mock).mockResolvedValue({ uid123: 'editor' });
      (admin.auth as jest.Mock).mockReturnValue({
        listUsers: jest.fn().mockResolvedValue({
          users: [makeFirebaseRecord()],
          pageToken: undefined,
        }),
      });

      const result = await listUsers(10);
      expect(result.users).toHaveLength(1);
      expect(result.users[0]?.role).toBe('editor');
    });

    it('falls back to "user" role when uid is missing from batch result', async () => {
      (userApiClient.getUserRolesBatch as jest.Mock).mockResolvedValue({}); // uid not in response
      (admin.auth as jest.Mock).mockReturnValue({
        listUsers: jest.fn().mockResolvedValue({
          users: [makeFirebaseRecord()],
          pageToken: undefined,
        }),
      });

      const result = await listUsers();
      expect(result.users[0]?.role).toBe('user');
    });
  });
});
