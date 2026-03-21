/**
 * Unit tests for usersService.
 *
 * Coverage:
 * - Authorization: authorizeUser
 * - CRUD operations: createUser, getUserByUid, updateUser, deleteUser, listUsers
 * - Bootstrapping: bootstrapAdminUser
 */

// ── Mocks (must be declared before any imports that trigger module initialisation) ──

jest.mock('@elastic-resume-base/synapse', () => {
  return {
    FirestoreUserDocumentStore: jest.fn(),
    FirestorePreApprovedStore: jest.fn(),
  };
});

jest.mock('../../../src/config', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'silent',
    projectId: 'demo-test',
    firestoreUsersCollection: 'users',
    firestorePreApprovedUsersCollection: 'pre_approved_users',
    onboardableEmailDomains: '',
    bootstrapAdminUserEmail: undefined as string | undefined,
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ── Imports (after mock declarations) ──

import { FirestoreUserDocumentStore, FirestorePreApprovedStore } from '@elastic-resume-base/synapse';
import { config } from '../../../src/config.js';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../../src/errors.js';
import {
  authorizeUser,
  createUser,
  getUserByUid,
  updateUser,
  deleteUser,
  listUsers,
  bootstrapAdminUser,
  _resetStores,
} from '../../../src/services/usersService.js';

// ── Default user data ──

const MOCK_USER = {
  uid: 'uid123',
  email: 'alice@example.com',
  role: 'user',
  enable: true,
};

// ── Helpers ──

/** Creates fresh store mocks and wires up the constructor mocks to return them. */
function setupMocks() {
  const userStore = {
    createUser: jest.fn(),
    getUserByUid: jest.fn(),
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    listUsers: jest.fn(),
  };
  const preApprovedStore = {
    add: jest.fn(),
    getByEmail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
  };

  (FirestoreUserDocumentStore as jest.Mock).mockImplementation(() => userStore);
  (FirestorePreApprovedStore as jest.Mock).mockImplementation(() => preApprovedStore);

  // Reset singletons so constructors are invoked fresh on next service call
  _resetStores();

  return { userStore, preApprovedStore };
}

// ── Test suite ──

describe('usersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (config as Record<string, unknown>)['onboardableEmailDomains'] = '';
    (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = undefined;
  });

  // ── authorizeUser ──────────────────────────────────────────────────────────

  describe('authorizeUser', () => {
    it('returns role and enable when user exists in users store', async () => {
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(MOCK_USER);

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(true);
      expect(userStore.getUserByUid).toHaveBeenCalledWith('uid123');
    });

    it('promotes user from pre-approved store when not in users store', async () => {
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue({ email: 'alice@example.com', role: 'admin' });
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'admin', enable: true });
      preApprovedStore.delete.mockResolvedValue(undefined);

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('admin');
      expect(result.enable).toBe(true);
      expect(userStore.createUser).toHaveBeenCalledWith({ uid: 'uid123', email: 'alice@example.com', role: 'admin', enable: true });
      expect(preApprovedStore.delete).toHaveBeenCalledWith('alice@example.com');
    });

    it('creates user with enable=false when email domain is onboardable', async () => {
      (config as Record<string, unknown>)['onboardableEmailDomains'] = 'example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(false);
      expect(userStore.createUser).toHaveBeenCalledWith({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false });
    });

    it('throws ForbiddenError when user not in any store and domain not onboardable', async () => {
      (config as Record<string, unknown>)['onboardableEmailDomains'] = 'company.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);

      await expect(
        authorizeUser({ uid: 'uid123', email: 'alice@blocked.com' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when no onboardable domains configured and user not found', async () => {
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);

      await expect(
        authorizeUser({ uid: 'uid123', email: 'alice@example.com' }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ── createUser ────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('creates a user and returns the record', async () => {
      const { userStore } = setupMocks();
      userStore.createUser.mockResolvedValue(MOCK_USER);

      const result = await createUser({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: true });

      expect(result.email).toBe('alice@example.com');
      expect(result.role).toBe('user');
      expect(result.enable).toBe(true);
    });

    it('throws ValidationError when email is invalid', async () => {
      setupMocks();
      await expect(createUser({ uid: 'uid123', email: 'not-an-email', role: 'user', enable: false })).rejects.toThrow(ValidationError);
    });

    it('throws ConflictError when uid already exists', async () => {
      const { userStore } = setupMocks();
      userStore.createUser.mockRejectedValue(new ConflictError('already exists'));

      await expect(createUser({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false })).rejects.toThrow(ConflictError);
    });
  });

  // ── getUserByUid ──────────────────────────────────────────────────────────

  describe('getUserByUid', () => {
    it('returns the user record for an existing UID', async () => {
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(MOCK_USER);

      const result = await getUserByUid('uid123');

      expect(result.uid).toBe('uid123');
      expect(result.email).toBe('alice@example.com');
      expect(result.role).toBe('user');
      expect(result.enable).toBe(true);
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));

      await expect(getUserByUid('missing-uid')).rejects.toThrow(NotFoundError);
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('updates the user and returns the updated record', async () => {
      const updatedData = { ...MOCK_USER, enable: false, role: 'admin' };
      const { userStore } = setupMocks();
      userStore.updateUser.mockResolvedValue(updatedData);

      const result = await updateUser('uid123', { enable: false, role: 'admin' });

      expect(result.enable).toBe(false);
      expect(result.role).toBe('admin');
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const { userStore } = setupMocks();
      userStore.updateUser.mockRejectedValue(new NotFoundError('not found'));

      await expect(updateUser('missing-uid', { role: 'admin' })).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when email is invalid', async () => {
      setupMocks();
      await expect(updateUser('uid123', { email: 'bad-email' })).rejects.toThrow(ValidationError);
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('deletes the user when they exist', async () => {
      const { userStore } = setupMocks();
      userStore.deleteUser.mockResolvedValue(undefined);

      await deleteUser('uid123');
      expect(userStore.deleteUser).toHaveBeenCalledWith('uid123');
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const { userStore } = setupMocks();
      userStore.deleteUser.mockRejectedValue(new NotFoundError('not found'));

      await expect(deleteUser('missing-uid')).rejects.toThrow(NotFoundError);
    });
  });

  // ── listUsers ─────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('returns a page of user records', async () => {
      const { userStore } = setupMocks();
      userStore.listUsers.mockResolvedValue({ users: [MOCK_USER, MOCK_USER], pageToken: undefined });

      const result = await listUsers(2);
      expect(result.users).toHaveLength(2);
      expect(result.users[0]?.email).toBe('alice@example.com');
    });

    it('returns an empty list when no users exist', async () => {
      const { userStore } = setupMocks();
      userStore.listUsers.mockResolvedValue({ users: [], pageToken: undefined });

      const result = await listUsers();
      expect(result.users).toHaveLength(0);
      expect(result.pageToken).toBeUndefined();
    });

    it('passes filters to the store', async () => {
      const { userStore } = setupMocks();
      userStore.listUsers.mockResolvedValue({ users: [], pageToken: undefined });

      await listUsers(10, undefined, { role: 'admin' });
      expect(userStore.listUsers).toHaveBeenCalledWith(10, undefined, { role: 'admin' });
    });
  });

  // ── bootstrapAdminUser ────────────────────────────────────────────────────

  describe('bootstrapAdminUser', () => {
    it('skips when no bootstrap email is configured', async () => {
      (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = undefined;
      const { userStore } = setupMocks();

      await bootstrapAdminUser();

      expect(userStore.getUserByEmail).not.toHaveBeenCalled();
    });

    it('adds admin email to pre-approved store when not already present', async () => {
      (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = 'admin@example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByEmail.mockResolvedValue(null);
      preApprovedStore.getByEmail.mockResolvedValue(null);
      preApprovedStore.add.mockResolvedValue({ email: 'admin@example.com', role: 'admin' });

      await bootstrapAdminUser();

      expect(preApprovedStore.add).toHaveBeenCalledWith({ email: 'admin@example.com', role: 'admin' });
    });

    it('skips if admin email already in users store', async () => {
      (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = 'admin@example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByEmail.mockResolvedValue({ uid: 'uid1', email: 'admin@example.com', role: 'admin', enable: true });

      await bootstrapAdminUser();
      expect(preApprovedStore.add).not.toHaveBeenCalled();
    });

    it('skips if admin email already in pre-approved store', async () => {
      (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = 'admin@example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByEmail.mockResolvedValue(null);
      preApprovedStore.getByEmail.mockResolvedValue({ email: 'admin@example.com', role: 'admin' });

      await bootstrapAdminUser();
      expect(preApprovedStore.add).not.toHaveBeenCalled();
    });
  });
});
