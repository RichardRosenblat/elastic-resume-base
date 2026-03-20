/**
 * Unit tests for usersService.
 *
 * Coverage:
 * - Authorization: authorizeUser
 * - CRUD operations: createUser, getUserByUid, updateUser, deleteUser, listUsers
 * - Bootstrapping: bootstrapAdminUser
 */

// ── Mocks (must be declared before any imports that trigger module initialisation) ──

jest.mock('firebase-admin/firestore', () => {
  const Timestamp = {
    now: jest.fn(() => ({ toDate: () => new Date('2024-01-01T00:00:00.000Z') })),
  };

  return {
    getFirestore: jest.fn(),
    Timestamp,
  };
});

jest.mock('../../../src/config', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'silent',
    projectId: 'demo-test',
    firestoreUsersCollection: 'users',
    firestorePreApprovedUsersCollection: 'pre_approved_users',
    allowedEmailDomains: '',
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

import { getFirestore } from 'firebase-admin/firestore';
import type { DocumentSnapshot, DocumentReference } from 'firebase-admin/firestore';
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
} from '../../../src/services/usersService.js';

// ── Types ──

type MockFirestore = {
  collection: jest.Mock;
  getAll?: jest.Mock;
};

type MockCollection = {
  doc: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  get: jest.Mock;
  add: jest.Mock;
};

type MockDocRef = {
  id: string;
  set: jest.Mock;
  get: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  ref?: { delete: jest.Mock };
};

type MockQuery = {
  limit: jest.Mock;
  startAfter: jest.Mock;
  get: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
};

// ── Helpers ──

/**
 * Creates a fake Firestore document snapshot.
 */
function makeDocSnapshot(
  id: string,
  data: Record<string, unknown> | null,
): DocumentSnapshot {
  const ref = {
    id,
    delete: jest.fn().mockResolvedValue(undefined),
  } as unknown as DocumentReference;

  return {
    id,
    exists: data !== null,
    data: () => data ?? undefined,
    ref,
  } as unknown as DocumentSnapshot;
}

/**
 * Builds a minimal mock Firestore instance.
 */
function buildMockFirestore(
  docData: Record<string, unknown> | null = null,
  queryDocs: DocumentSnapshot[] = [],
): MockFirestore {
  const mockDocRef: MockDocRef = {
    id: 'uid123',
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', docData)),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockQuery: MockQuery = {
    limit: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: queryDocs, empty: queryDocs.length === 0 }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
  };

  const mockCollection: MockCollection = {
    doc: jest.fn().mockReturnValue(mockDocRef),
    where: jest.fn().mockReturnValue(mockQuery),
    orderBy: jest.fn().mockReturnValue(mockQuery),
    limit: jest.fn().mockReturnValue(mockQuery),
    get: jest.fn().mockResolvedValue({ docs: queryDocs, empty: queryDocs.length === 0 }),
    add: jest.fn().mockResolvedValue({ id: 'new-doc-id' }),
  };

  const mockFirestore: MockFirestore = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };

  return mockFirestore;
}

// ── Default user data ──

const USER_DATA: Record<string, unknown> = {
  email: 'alice@example.com',
  role: 'user',
  enable: true,
};

// ── Test suite ──

describe('usersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (config as Record<string, unknown>)['allowedEmailDomains'] = '';
    (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = undefined;
  });

  // ── authorizeUser ──────────────────────────────────────────────────────────

  describe('authorizeUser', () => {
    it('returns role and enable when user exists in users collection', async () => {
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(true);
    });

    it('promotes user from pre_approved_users when not in users collection', async () => {
      const mockFs = buildMockFirestore(null); // user doc does not exist
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const preApprovedDoc = makeDocSnapshot('pre-doc-id', { email: 'alice@example.com', role: 'admin' });

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      // First call: doc().get() returns null (user not in users collection)
      collMock.doc.mockReturnValue({
        get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', null)),
        set: jest.fn().mockResolvedValue(undefined),
      });
      // Second call: where().limit().get() for pre_approved_users returns a doc
      collMock.where.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: false, docs: [preApprovedDoc] }),
        }),
      });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('admin');
      expect(result.enable).toBe(true);
    });

    it('creates user with enable=false when email domain is allowed', async () => {
      (config as Record<string, unknown>)['allowedEmailDomains'] = 'example.com';
      const mockFs = buildMockFirestore(null);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      const setMock = jest.fn().mockResolvedValue(undefined);
      collMock.doc.mockReturnValue({
        get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', null)),
        set: setMock,
      });
      collMock.where.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      });

      const result = await authorizeUser({ uid: 'uid123', email: 'alice@example.com' });

      expect(result.role).toBe('user');
      expect(result.enable).toBe(false);
    });

    it('throws ForbiddenError when user not in any collection and domain not allowed', async () => {
      (config as Record<string, unknown>)['allowedEmailDomains'] = 'company.com';
      const mockFs = buildMockFirestore(null);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      collMock.doc.mockReturnValue({
        get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', null)),
        set: jest.fn(),
      });
      collMock.where.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      });

      await expect(
        authorizeUser({ uid: 'uid123', email: 'alice@blocked.com' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when no allowed domains configured and user not found', async () => {
      (config as Record<string, unknown>)['allowedEmailDomains'] = '';
      const mockFs = buildMockFirestore(null);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      collMock.doc.mockReturnValue({
        get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', null)),
        set: jest.fn(),
      });
      collMock.where.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      });

      await expect(
        authorizeUser({ uid: 'uid123', email: 'alice@example.com' }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ── createUser ────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('creates a user document and returns the normalised record', async () => {
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      const docRef = {
        get: jest.fn()
          .mockResolvedValueOnce(makeDocSnapshot('uid123', null)) // UID does not exist
          .mockResolvedValueOnce(makeDocSnapshot('uid123', USER_DATA)), // after set
        set: jest.fn().mockResolvedValue(undefined),
      };
      collMock.doc.mockReturnValue(docRef);

      const result = await createUser({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: true });

      expect(result.email).toBe('alice@example.com');
      expect(result.role).toBe('user');
      expect(result.enable).toBe(true);
    });

    it('throws ValidationError when email is invalid', async () => {
      await expect(createUser({ uid: 'uid123', email: 'not-an-email', role: 'user', enable: false })).rejects.toThrow(ValidationError);
    });

    it('throws ConflictError when uid already exists', async () => {
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      collMock.doc.mockReturnValue({
        get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', USER_DATA)), // exists!
      });

      await expect(createUser({ uid: 'uid123', email: 'alice@example.com', role: 'user', enable: false })).rejects.toThrow(ConflictError);
    });
  });

  // ── getUserByUid ──────────────────────────────────────────────────────────

  describe('getUserByUid', () => {
    it('returns the user record for an existing UID', async () => {
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const result = await getUserByUid('uid123');

      expect(result.uid).toBe('uid123');
      expect(result.email).toBe('alice@example.com');
      expect(result.role).toBe('user');
      expect(result.enable).toBe(true);
    });

    it('throws NotFoundError when the document does not exist', async () => {
      const mockFs = buildMockFirestore(null);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      await expect(getUserByUid('missing-uid')).rejects.toThrow(NotFoundError);
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('updates the user and returns the updated record', async () => {
      const updatedData = { ...USER_DATA, enable: false, role: 'admin' };
      const mockFs = buildMockFirestore(updatedData);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      const docRef = {
        get: jest.fn()
          .mockResolvedValueOnce(makeDocSnapshot('uid123', USER_DATA)) // existence check
          .mockResolvedValueOnce(makeDocSnapshot('uid123', updatedData)), // final fetch
        update: jest.fn().mockResolvedValue(undefined),
      };
      collMock.doc.mockReturnValue(docRef);

      const result = await updateUser('uid123', { enable: false, role: 'admin' });

      expect(result.enable).toBe(false);
      expect(result.role).toBe('admin');
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const mockFs = buildMockFirestore(null);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      await expect(updateUser('missing-uid', { role: 'admin' })).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when email is invalid', async () => {
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      collMock.doc.mockReturnValue({
        get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', USER_DATA)),
        update: jest.fn(),
      });

      await expect(updateUser('uid123', { email: 'bad-email' })).rejects.toThrow(ValidationError);
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('deletes the user when they exist', async () => {
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      const deleteMock = jest.fn().mockResolvedValue(undefined);
      collMock.doc.mockReturnValue({
        id: 'uid123',
        get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', USER_DATA)),
        delete: deleteMock,
      });

      await deleteUser('uid123');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const mockFs = buildMockFirestore(null);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      await expect(deleteUser('missing-uid')).rejects.toThrow(NotFoundError);
    });
  });

  // ── listUsers ─────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('returns a page of user records', async () => {
      const docs = [makeDocSnapshot('uid1', USER_DATA), makeDocSnapshot('uid2', USER_DATA)];
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      collMock.orderBy.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs, empty: false }),
        }),
      });

      const result = await listUsers(2);
      expect(result.users).toHaveLength(2);
      expect(result.users[0]?.email).toBe('alice@example.com');
    });

    it('returns an empty list when no users exist', async () => {
      const mockFs = buildMockFirestore(null);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      collMock.orderBy.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
        }),
      });

      const result = await listUsers();
      expect(result.users).toHaveLength(0);
      expect(result.pageToken).toBeUndefined();
    });
  });

  // ── bootstrapAdminUser ────────────────────────────────────────────────────

  describe('bootstrapAdminUser', () => {
    it('skips when no bootstrap email is configured', async () => {
      (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = undefined;
      await bootstrapAdminUser();
      expect(getFirestore).not.toHaveBeenCalled();
    });

    it('adds admin email to pre_approved_users when not already present', async () => {
      (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = 'admin@example.com';

      const addMock = jest.fn().mockResolvedValue({ id: 'new-id' });
      const mockFs = {
        collection: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
            }),
          }),
          add: addMock,
        }),
      };
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      await bootstrapAdminUser();

      expect(addMock).toHaveBeenCalledWith({ email: 'admin@example.com', role: 'admin' });
    });

    it('skips if admin email already in users collection', async () => {
      (config as Record<string, unknown>)['bootstrapAdminUserEmail'] = 'admin@example.com';

      const addMock = jest.fn();
      const mockFs = {
        collection: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                empty: false,
                docs: [makeDocSnapshot('uid1', { email: 'admin@example.com', role: 'admin', enable: true })],
              }),
            }),
          }),
          add: addMock,
        }),
      };
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      await bootstrapAdminUser();
      expect(addMock).not.toHaveBeenCalled();
    });
  });
});
