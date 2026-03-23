/**
 * Unit tests for bff-gateway usersService RBAC logic.
 */

jest.mock('../../../src/services/userApiClient', () => ({
  authorizeUser: jest.fn(),
  getUserById: jest.fn(),
  listUsersFromApi: jest.fn(),
  updateUserInApi: jest.fn(),
  deleteUserFromApi: jest.fn(),
  listPreApprovedFromApi: jest.fn(),
  getPreApprovedFromApi: jest.fn(),
  addPreApprovedInApi: jest.fn(),
  deletePreApprovedFromApi: jest.fn(),
  updatePreApprovedInApi: jest.fn(),
}));

jest.mock('../../../src/config', () => ({
  config: {
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

import * as userApiClient from '../../../src/services/userApiClient.js';
import { ForbiddenError } from '../../../src/errors.js';
import {
  getUserByUid,
  listUsers,
  updateUser,
  deleteUser,
  listPreApproved,
  getPreApproved,
  addPreApproved,
  deletePreApproved,
} from '../../../src/services/usersService.js';

const mockUser = {
  uid: 'uid123',
  email: 'user@example.com',
  role: 'user',
  enable: true,
};

const mockPreApproved = {
  email: 'test@example.com',
  role: 'admin',
};

describe('usersService (bff-gateway)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getUserByUid
  // ---------------------------------------------------------------------------
  describe('getUserByUid', () => {
    it('returns user from UserAPI', async () => {
      (userApiClient.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const result = await getUserByUid('uid123');
      expect(result.uid).toBe('uid123');
      expect(userApiClient.getUserById).toHaveBeenCalledWith('uid123');
    });
  });

  // ---------------------------------------------------------------------------
  // listUsers
  // ---------------------------------------------------------------------------
  describe('listUsers', () => {
    it('returns users list from UserAPI without filters', async () => {
      (userApiClient.listUsersFromApi as jest.Mock).mockResolvedValue({
        users: [mockUser],
        pageToken: undefined,
      });

      const result = await listUsers(10);
      expect(result.users).toHaveLength(1);
      expect(userApiClient.listUsersFromApi).toHaveBeenCalledWith(10, undefined, undefined);
    });

    it('passes filters to UserAPI', async () => {
      (userApiClient.listUsersFromApi as jest.Mock).mockResolvedValue({
        users: [mockUser],
        pageToken: undefined,
      });

      await listUsers(10, undefined, { role: 'admin', enable: true });
      expect(userApiClient.listUsersFromApi).toHaveBeenCalledWith(10, undefined, { role: 'admin', enable: true });
    });
  });

  // ---------------------------------------------------------------------------
  // updateUser
  // ---------------------------------------------------------------------------
  describe('updateUser', () => {
    it('allows admin to update any user with any field', async () => {
      (userApiClient.updateUserInApi as jest.Mock).mockResolvedValue({ ...mockUser, role: 'admin' });

      const result = await updateUser('uid123', { role: 'admin', enable: false }, 'admin-uid', 'admin');
      expect(result.role).toBe('admin');
      expect(userApiClient.updateUserInApi).toHaveBeenCalledWith('uid123', { role: 'admin', enable: false });
    });

    it('allows non-admin to update their own email', async () => {
      (userApiClient.updateUserInApi as jest.Mock).mockResolvedValue({ ...mockUser, email: 'new@example.com' });

      const result = await updateUser('uid123', { email: 'new@example.com' }, 'uid123', 'user');
      expect(result.email).toBe('new@example.com');
      expect(userApiClient.updateUserInApi).toHaveBeenCalledWith('uid123', { email: 'new@example.com' });
    });

    it('throws ForbiddenError when non-admin tries to update role field', async () => {
      await expect(
        updateUser('uid123', { role: 'admin' }, 'uid123', 'user'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when non-admin tries to update enable field', async () => {
      await expect(
        updateUser('uid123', { enable: true }, 'uid123', 'user'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows admin to update email without domain validation', async () => {
      (userApiClient.updateUserInApi as jest.Mock).mockResolvedValue({ ...mockUser, email: 'user@any-domain.org' });

      const result = await updateUser('uid123', { email: 'user@any-domain.org' }, 'admin-uid', 'admin');
      expect(result.email).toBe('user@any-domain.org');
    });
  });

  // ---------------------------------------------------------------------------
  // deleteUser
  // ---------------------------------------------------------------------------
  describe('deleteUser', () => {
    it('throws ForbiddenError when requester is not admin', async () => {
      await expect(deleteUser('uid123', 'user')).rejects.toThrow(ForbiddenError);
    });

    it('deletes user when requester is admin', async () => {
      (userApiClient.deleteUserFromApi as jest.Mock).mockResolvedValue(undefined);

      await deleteUser('uid123', 'admin');
      expect(userApiClient.deleteUserFromApi).toHaveBeenCalledWith('uid123');
    });
  });

  // ---------------------------------------------------------------------------
  // listPreApproved
  // ---------------------------------------------------------------------------
  describe('listPreApproved', () => {
    it('throws ForbiddenError when requester is not admin', async () => {
      await expect(listPreApproved('user')).rejects.toThrow(ForbiddenError);
    });

    it('returns list from UserAPI when admin', async () => {
      (userApiClient.listPreApprovedFromApi as jest.Mock).mockResolvedValue([mockPreApproved]);

      const result = await listPreApproved('admin');
      expect(result).toHaveLength(1);
      expect(userApiClient.listPreApprovedFromApi).toHaveBeenCalledWith(undefined);
    });

    it('passes filters to UserAPI', async () => {
      (userApiClient.listPreApprovedFromApi as jest.Mock).mockResolvedValue([mockPreApproved]);

      await listPreApproved('admin', { role: 'admin' });
      expect(userApiClient.listPreApprovedFromApi).toHaveBeenCalledWith({ role: 'admin' });
    });
  });

  // ---------------------------------------------------------------------------
  // getPreApproved
  // ---------------------------------------------------------------------------
  describe('getPreApproved', () => {
    it('throws ForbiddenError when requester is not admin', async () => {
      await expect(getPreApproved('test@example.com', 'user')).rejects.toThrow(ForbiddenError);
    });

    it('returns pre-approved user when admin', async () => {
      (userApiClient.getPreApprovedFromApi as jest.Mock).mockResolvedValue(mockPreApproved);

      const result = await getPreApproved('test@example.com', 'admin');
      expect(result.email).toBe('test@example.com');
      expect(userApiClient.getPreApprovedFromApi).toHaveBeenCalledWith('test@example.com');
    });
  });

  // ---------------------------------------------------------------------------
  // Pre-approve management
  // ---------------------------------------------------------------------------
  describe('addPreApproved', () => {
    it('throws ForbiddenError when requester is not admin', async () => {
      await expect(addPreApproved('test@example.com', 'admin', 'user')).rejects.toThrow(ForbiddenError);
    });

    it('adds pre-approved user when requester is admin', async () => {
      (userApiClient.addPreApprovedInApi as jest.Mock).mockResolvedValue(mockPreApproved);

      const result = await addPreApproved('test@example.com', 'admin', 'admin');
      expect(result.email).toBe('test@example.com');
    });

    it('adds pre-approved user with any email domain (no domain validation)', async () => {
      (userApiClient.addPreApprovedInApi as jest.Mock).mockResolvedValue({
        email: 'test@any-domain.org',
        role: 'admin',
      });

      const result = await addPreApproved('test@any-domain.org', 'admin', 'admin');
      expect(result.email).toBe('test@any-domain.org');
    });
  });

  describe('deletePreApproved', () => {
    it('throws ForbiddenError when requester is not admin', async () => {
      await expect(deletePreApproved('test@example.com', 'user')).rejects.toThrow(ForbiddenError);
    });

    it('deletes pre-approved user when requester is admin', async () => {
      (userApiClient.deletePreApprovedFromApi as jest.Mock).mockResolvedValue(undefined);

      await deletePreApproved('test@example.com', 'admin');
      expect(userApiClient.deletePreApprovedFromApi).toHaveBeenCalledWith('test@example.com');
    });
  });
});
