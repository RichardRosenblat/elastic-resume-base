/**
 * Unit tests for usersService.
 *
 * Coverage:
 * - Authorization: authorizeUser
 * - CRUD operations: getUserByUid, updateUser, deleteUser, listUsers
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
    autoUserCreationDomains: undefined as string | undefined,
    autoAdminCreationDomains: undefined as string | undefined,
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
import { NotFoundError, ForbiddenError } from '../../../src/errors.js';
import { authorizeUser,
  matchesEmailOrDomain,
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
    (config as Record<string, unknown>)['autoUserCreationDomains'] = undefined;
    (config as Record<string, unknown>)['autoAdminCreationDomains'] = undefined;
    (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = undefined;
  });

  // ── authorizeUser ──────────────────────────────────────────────────────────

  describe('authorizeUser', () => {
    it('returns role and enable when user exists in users store with enable=true (no reason)', async () => {
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(MOCK_USER);

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(userStore.getUserByUid).toHaveBeenCalledWith('uid123');
    });

    it('returns role and enable=false with reason=DISABLED when user is disabled in users store', async () => {
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue({ ...MOCK_USER, enable: false });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(false);
      expect(result.reason).toBe('DISABLED');
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

    it('creates user with enable=false and reason=PENDING_APPROVAL when email domain is onboardable (legacy ONBOARDABLE_EMAIL_DOMAINS)', async () => {
      (config as Record<string, unknown>)['onboardableEmailDomains'] = 'example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(false);
      expect(result.reason).toBe('PENDING_APPROVAL');
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

    it('continues to step 2 when getUserByUid throws a cross-module NOT_FOUND error (code-based check)', async () => {
      // Simulate Synapse throwing its own NotFoundError (different class identity at runtime).
      // The error has code='NOT_FOUND' but is NOT an instance of Toolbox's NotFoundError.
      const synapseLikeNotFoundError = Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(synapseLikeNotFoundError);
      preApprovedStore.getByEmail.mockResolvedValue({ email: 'alice@example.com', role: 'admin' });
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'admin', enable: true });
      preApprovedStore.delete.mockResolvedValue(undefined);

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('admin');
      expect(result.enable).toBe(true);
    });

    // ── AUTO_USER_CREATION_DOMAINS ────────────────────────────────────────────

    it('creates user with role=user, enable=false and reason=PENDING_APPROVAL when email domain matches AUTO_USER_CREATION_DOMAINS', async () => {
      (config as Record<string, unknown>)['autoUserCreationDomains'] = 'example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(false);
      expect(result.reason).toBe('PENDING_APPROVAL');
      expect(userStore.createUser).toHaveBeenCalledWith({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false });
    });

    it('creates user with role=user, enable=false when explicit email matches AUTO_USER_CREATION_DOMAINS', async () => {
      (config as Record<string, unknown>)['autoUserCreationDomains'] = 'alice@example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(false);
    });

    it('does not create user when AUTO_USER_CREATION_DOMAINS is set to empty string (disabled)', async () => {
      (config as Record<string, unknown>)['autoUserCreationDomains'] = '';
      (config as Record<string, unknown>)['onboardableEmailDomains'] = 'example.com'; // legacy fallback should be ignored
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);

      await expect(
        authorizeUser({ uid: 'uid123', email: 'alice@example.com' }),
      ).rejects.toThrow(ForbiddenError);

      expect(userStore.createUser).not.toHaveBeenCalled();
    });

    it('AUTO_USER_CREATION_DOMAINS takes precedence over legacy ONBOARDABLE_EMAIL_DOMAINS', async () => {
      (config as Record<string, unknown>)['autoUserCreationDomains'] = 'other.com';
      (config as Record<string, unknown>)['onboardableEmailDomains'] = 'example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);

      // alice@example.com matches legacy domain but NOT autoUserCreationDomains → 403
      await expect(
        authorizeUser({ uid: 'uid123', email: 'alice@example.com' }),
      ).rejects.toThrow(ForbiddenError);
    });

    // ── AUTO_ADMIN_CREATION_DOMAINS ───────────────────────────────────────────

    it('creates admin user with role=admin, enable=true when email domain matches AUTO_ADMIN_CREATION_DOMAINS', async () => {
      (config as Record<string, unknown>)['autoAdminCreationDomains'] = 'example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'admin', enable: true });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('admin');
      expect(result.enable).toBe(true);
      expect(userStore.createUser).toHaveBeenCalledWith({ uid: 'uid123', email: 'alice@example.com', role: 'admin', enable: true });
    });

    it('creates admin user with role=admin, enable=true when explicit email matches AUTO_ADMIN_CREATION_DOMAINS', async () => {
      (config as Record<string, unknown>)['autoAdminCreationDomains'] = 'alice@example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'admin', enable: true });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('admin');
      expect(result.enable).toBe(true);
    });

    it('does not auto-create admin when AUTO_ADMIN_CREATION_DOMAINS is set to empty string (disabled)', async () => {
      (config as Record<string, unknown>)['autoAdminCreationDomains'] = '';
      (config as Record<string, unknown>)['autoUserCreationDomains'] = 'example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      // Falls through to AUTO_USER_CREATION_DOMAINS
      expect(result.role).toBe('user');
      expect(result.enable).toBe(false);
    });

    it('admin creation takes priority over user creation when email matches both domains', async () => {
      (config as Record<string, unknown>)['autoAdminCreationDomains'] = 'example.com';
      (config as Record<string, unknown>)['autoUserCreationDomains'] = 'example.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);
      userStore.createUser.mockResolvedValue({ uid: 'uid123', email: 'alice@example.com', role: 'admin', enable: true });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('admin');
      expect(result.enable).toBe(true);
      expect(userStore.createUser).toHaveBeenCalledWith({ uid: 'uid123', email: 'alice@example.com', role: 'admin', enable: true });
    });

    it('throws 403 when email matches no auto-creation domain', async () => {
      (config as Record<string, unknown>)['autoAdminCreationDomains'] = 'admin.com';
      (config as Record<string, unknown>)['autoUserCreationDomains'] = 'user.com';
      const { userStore, preApprovedStore } = setupMocks();
      userStore.getUserByUid.mockRejectedValue(new NotFoundError('not found'));
      preApprovedStore.getByEmail.mockResolvedValue(null);

      await expect(
        authorizeUser({ uid: 'uid123', email: 'alice@other.com' }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ── matchesEmailOrDomain ──────────────────────────────────────────────────

  describe('matchesEmailOrDomain', () => {
    it('matches a plain domain pattern', () => {
      expect(matchesEmailOrDomain('alice@example.com', ['example.com'])).toBe(true);
    });

    it('matches a @-prefixed domain pattern', () => {
      expect(matchesEmailOrDomain('alice@example.com', ['@example.com'])).toBe(true);
    });

    it('matches an exact email pattern', () => {
      expect(matchesEmailOrDomain('alice@example.com', ['alice@example.com'])).toBe(true);
    });

    it('does not match a different domain', () => {
      expect(matchesEmailOrDomain('alice@other.com', ['example.com'])).toBe(false);
    });

    it('does not match a different email on the same domain', () => {
      expect(matchesEmailOrDomain('bob@example.com', ['alice@example.com'])).toBe(false);
    });

    it('is case-insensitive for domains', () => {
      expect(matchesEmailOrDomain('alice@EXAMPLE.COM', ['example.com'])).toBe(true);
    });

    it('is case-insensitive for exact email patterns', () => {
      expect(matchesEmailOrDomain('ALICE@example.com', ['alice@example.com'])).toBe(true);
    });

    it('returns false for an email without @', () => {
      expect(matchesEmailOrDomain('notanemail', ['example.com'])).toBe(false);
    });

    it('matches against multiple patterns', () => {
      expect(matchesEmailOrDomain('alice@example.com', ['other.com', 'example.com'])).toBe(true);
    });

    it('returns false for empty patterns array', () => {
      expect(matchesEmailOrDomain('alice@example.com', [])).toBe(false);
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
      userStore.getUserByUid.mockResolvedValue({ ...MOCK_USER, role: 'user', enable: true });
      userStore.updateUser.mockResolvedValue(updatedData);

      const result = await updateUser('uid123', { enable: false, role: 'admin' });

      expect(result.enable).toBe(false);
      expect(result.role).toBe('admin');
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const { userStore } = setupMocks();
      userStore.updateUser.mockRejectedValue(new NotFoundError('not found'));
      // role:'admin' → need to check existing user first; simulate a regular user
      userStore.getUserByUid.mockResolvedValue({ ...MOCK_USER, role: 'user', enable: true });

      await expect(updateUser('missing-uid', { role: 'admin' })).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when trying to disable the last enabled admin', async () => {
      const adminUser = { ...MOCK_USER, role: 'admin', enable: true };
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(adminUser);
      userStore.listUsers.mockResolvedValue({ users: [adminUser], pageToken: undefined });

      await expect(updateUser('uid123', { enable: false })).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when trying to demote the last enabled admin', async () => {
      const adminUser = { ...MOCK_USER, role: 'admin', enable: true };
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(adminUser);
      userStore.listUsers.mockResolvedValue({ users: [adminUser], pageToken: undefined });

      await expect(updateUser('uid123', { role: 'user' })).rejects.toThrow(ForbiddenError);
    });

    it('allows disabling an admin when another enabled admin exists', async () => {
      const adminUser = { ...MOCK_USER, role: 'admin', enable: true };
      const anotherAdmin = { uid: 'uid456', email: 'bob@example.com', role: 'admin', enable: true };
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(adminUser);
      userStore.listUsers.mockResolvedValue({ users: [adminUser, anotherAdmin], pageToken: undefined });
      userStore.updateUser.mockResolvedValue({ ...adminUser, enable: false });

      const result = await updateUser('uid123', { enable: false });
      expect(result.enable).toBe(false);
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('deletes the user when they exist', async () => {
      const regularUser = { ...MOCK_USER, role: 'user', enable: true };
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(regularUser);
      userStore.deleteUser.mockResolvedValue(undefined);

      await deleteUser('uid123');
      expect(userStore.deleteUser).toHaveBeenCalledWith('uid123');
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue({ ...MOCK_USER, role: 'user', enable: true });
      userStore.deleteUser.mockRejectedValue(new NotFoundError('not found'));

      await expect(deleteUser('missing-uid')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when trying to delete the last enabled admin', async () => {
      const adminUser = { ...MOCK_USER, role: 'admin', enable: true };
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(adminUser);
      userStore.listUsers.mockResolvedValue({ users: [adminUser], pageToken: undefined });

      await expect(deleteUser('uid123')).rejects.toThrow(ForbiddenError);
    });

    it('allows deleting an admin when another enabled admin exists', async () => {
      const adminUser = { ...MOCK_USER, role: 'admin', enable: true };
      const anotherAdmin = { uid: 'uid456', email: 'bob@example.com', role: 'admin', enable: true };
      const { userStore } = setupMocks();
      userStore.getUserByUid.mockResolvedValue(adminUser);
      userStore.listUsers.mockResolvedValue({ users: [adminUser, anotherAdmin], pageToken: undefined });
      userStore.deleteUser.mockResolvedValue(undefined);

      await deleteUser('uid123');
      expect(userStore.deleteUser).toHaveBeenCalledWith('uid123');
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
