/**
 * Unit tests for usersService.
 *
 * Coverage:
 * - CRUD operations: createUser, getUserByUid, updateUser, deleteUser, listUsers
 * - BFF access check: getUserRoleByEmail with Google Drive (Bugle) and Firestore (Synapse) paths
 * - Batch role lookup: getUserRolesBatch
 *
 * Scenarios for the BFF access logic (Task 5 requirement):
 * 1. User email is returned by the Google Drive permissions mock → admin access
 * 2. ADMIN_SHEET_FILE_ID is NOT set, user found in Firestore → their stored role
 * 3. User has no access anywhere (ADMIN_SHEET_FILE_ID set but not in Drive)
 * 4. ADMIN_SHEET_FILE_ID missing → fallback to Firestore check
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

jest.mock('@elastic-resume-base/bugle', () => ({
  DrivePermissionsService: jest.fn(),
}));

jest.mock('../../../src/config', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'silent',
    projectId: 'demo-test',
    adminSheetFileId: undefined as string | undefined,
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
import { DrivePermissionsService } from '@elastic-resume-base/bugle';
import { config } from '../../../src/config.js';
import { NotFoundError, ConflictError, ValidationError } from '@elastic-resume-base/synapse';
import {
  createUser,
  getUserByUid,
  updateUser,
  deleteUser,
  listUsers,
  getUserRoleByEmail,
  getUserRolesBatch,
} from '../../../src/services/usersService.js';

// ── Types ──

type MockFirestore = {
  collection: jest.Mock;
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
  startAfter: jest.Mock;
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
  return {
    id,
    exists: data !== null,
    data: () => data ?? undefined,
    ref: { id } as DocumentReference,
  } as unknown as DocumentSnapshot;
}

/**
 * Builds a minimal mock Firestore instance.
 *
 * @param docData - Data returned by `.doc().get()` for the primary document.
 * @param queryDocs - Documents returned by `.where().limit().get()` query.
 * @param listDocs - Documents returned by `.orderBy().limit().get()` query (listUsers).
 */
function buildMockFirestore(
  docData: Record<string, unknown> | null = null,
  queryDocs: DocumentSnapshot[] = [],
  listDocs?: DocumentSnapshot[],
): MockFirestore {
  const getAll = jest.fn().mockResolvedValue([]);

  const mockDocRef: MockDocRef = {
    id: 'uid123',
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(makeDocSnapshot('uid123', docData)),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    startAfter: jest.fn(),
  };

  const mockQuery: MockQuery = {
    limit: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    get: jest
      .fn()
      .mockResolvedValueOnce({ docs: listDocs ?? [], empty: (listDocs ?? []).length === 0 })
      .mockResolvedValue({ docs: queryDocs, empty: queryDocs.length === 0 }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
  };

  const mockCollection: MockCollection = {
    doc: jest.fn().mockReturnValue(mockDocRef),
    where: jest.fn().mockReturnValue(mockQuery),
    orderBy: jest.fn().mockReturnValue(mockQuery),
    limit: jest.fn().mockReturnValue(mockQuery),
    get: jest.fn().mockResolvedValue({ docs: queryDocs, empty: queryDocs.length === 0 }),
    add: jest.fn(),
  };

  const mockFirestore: MockFirestore & { getAll: jest.Mock } = {
    collection: jest.fn().mockReturnValue(mockCollection),
    getAll,
  };

  return mockFirestore as unknown as MockFirestore;
}

// ── Default user data ──

const USER_DATA: Record<string, unknown> = {
  email: 'alice@example.com',
  displayName: 'Alice',
  photoURL: undefined,
  role: 'user',
  disabled: false,
  createdAt: { toDate: () => new Date('2024-01-01T00:00:00.000Z') },
  updatedAt: { toDate: () => new Date('2024-01-01T00:00:00.000Z') },
};

// ── Test suite ──

describe('usersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset adminSheetFileId to undefined for most tests (uses Firestore path)
    (config as Record<string, unknown>)['adminSheetFileId'] = undefined;
  });

  // ── createUser ────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('creates a user document and returns the normalised record', async () => {
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      // Mock the duplicate-email query to return empty (no conflict)
      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      collMock.where.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      });

      const result = await createUser({ email: 'alice@example.com', displayName: 'Alice' });

      expect(result.email).toBe('alice@example.com');
      expect(result.role).toBe('user');
      expect(result.disabled).toBe(false);
    });

    it('throws ValidationError when email is invalid', async () => {
      await expect(createUser({ email: 'not-an-email' })).rejects.toThrow(ValidationError);
    });

    it('throws ConflictError when email is already registered', async () => {
      const existingDoc = makeDocSnapshot('other-uid', USER_DATA);
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      collMock.where.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: false, docs: [existingDoc] }),
        }),
      });

      await expect(createUser({ email: 'alice@example.com' })).rejects.toThrow(ConflictError);
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
    });

    it('throws NotFoundError when the document does not exist', async () => {
      const mockFs = buildMockFirestore(null); // null → document does not exist
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      await expect(getUserByUid('missing-uid')).rejects.toThrow(NotFoundError);
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('updates the user and returns the updated record', async () => {
      const updatedData = { ...USER_DATA, displayName: 'Alice Updated', role: 'editor' };
      const mockFs = buildMockFirestore(updatedData);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      // The first .get() checks existence; we override with existing doc
      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      const docRef = collMock.doc('uid123') as unknown as MockDocRef;
      docRef.get
        .mockResolvedValueOnce(makeDocSnapshot('uid123', USER_DATA)) // existence check
        .mockResolvedValueOnce(makeDocSnapshot('uid123', updatedData)); // final fetch

      const result = await updateUser('uid123', { displayName: 'Alice Updated', role: 'editor' });

      expect(result.displayName).toBe('Alice Updated');
      expect(result.role).toBe('editor');
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const mockFs = buildMockFirestore(null);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      await expect(updateUser('missing-uid', { displayName: 'Name' })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('throws ConflictError when the new email is taken by another user', async () => {
      const mockFs = buildMockFirestore(USER_DATA);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const collMock = (mockFs as unknown as MockFirestore).collection('users') as MockCollection;
      const docRef = collMock.doc() as unknown as MockDocRef;
      docRef.get.mockResolvedValueOnce(makeDocSnapshot('uid123', USER_DATA)); // exists

      // The email conflict query returns a different document
      const conflictDoc = makeDocSnapshot('other-uid', { ...USER_DATA, email: 'taken@example.com' });
      collMock.where.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: false, docs: [conflictDoc] }),
        }),
      });

      await expect(updateUser('uid123', { email: 'taken@example.com' })).rejects.toThrow(
        ConflictError,
      );
    });

    it('throws ValidationError when email is invalid', async () => {
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
      const mockFs = buildMockFirestore(USER_DATA, [], docs);
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
      const mockFs = buildMockFirestore(null, [], []);
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

  // ── getUserRoleByEmail (BFF access check) ────────────────────────────────

  describe('getUserRoleByEmail', () => {
    // Scenario 1: ADMIN_SHEET_FILE_ID is set and user email IS in Drive list → "admin"
    it('returns "admin" when ADMIN_SHEET_FILE_ID is set and user email is in Google Drive permissions', async () => {
      (config as Record<string, unknown>)['adminSheetFileId'] = 'sheet-file-id-123';

      // Mock DrivePermissionsService.getUsersWithFileAccess to include alice's email
      const mockGetUsersWithFileAccess = jest
        .fn()
        .mockResolvedValue(['alice@example.com', 'other@example.com']);
      (DrivePermissionsService as jest.Mock).mockImplementation(() => ({
        getUsersWithFileAccess: mockGetUsersWithFileAccess,
      }));

      const role = await getUserRoleByEmail('alice@example.com');

      expect(role).toBe('admin');
      expect(mockGetUsersWithFileAccess).toHaveBeenCalledWith('sheet-file-id-123');
    });

    // Scenario 3: ADMIN_SHEET_FILE_ID is set but user email is NOT in Drive list → no access (null)
    it('returns null when ADMIN_SHEET_FILE_ID is set but user email is NOT in Google Drive permissions', async () => {
      (config as Record<string, unknown>)['adminSheetFileId'] = 'sheet-file-id-123';

      // Drive list does NOT include alice's email
      const mockGetUsersWithFileAccess = jest
        .fn()
        .mockResolvedValue(['someone-else@example.com']);
      (DrivePermissionsService as jest.Mock).mockImplementation(() => ({
        getUsersWithFileAccess: mockGetUsersWithFileAccess,
      }));

      const role = await getUserRoleByEmail('alice@example.com');

      expect(role).toBeNull();
    });

    // Scenario 4: ADMIN_SHEET_FILE_ID is NOT set → fallback to Firestore
    // Scenario 2: User found in Firestore → their stored role
    it('falls back to Firestore and returns stored role when ADMIN_SHEET_FILE_ID is not set', async () => {
      // adminSheetFileId is undefined (default from beforeEach)
      (config as Record<string, unknown>)['adminSheetFileId'] = undefined;

      const userDoc = makeDocSnapshot('uid123', { ...USER_DATA, role: 'editor' });
      // Pass as listDocs (3rd arg) so the first mockQuery.get() call returns it
      const mockFs = buildMockFirestore(null, [], [userDoc]);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const role = await getUserRoleByEmail('alice@example.com');

      expect(role).toBe('editor');
      // DrivePermissionsService should NOT be called
      expect(DrivePermissionsService).not.toHaveBeenCalled();
    });

    // Scenario: User has no access anywhere (ADMIN_SHEET_FILE_ID not set, not in Firestore)
    it('returns null when ADMIN_SHEET_FILE_ID is not set and user is not in Firestore', async () => {
      (config as Record<string, unknown>)['adminSheetFileId'] = undefined;

      // Firestore returns empty query result (listDocs = [] → first get() returns empty)
      const mockFs = buildMockFirestore(null, [], []);
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      const role = await getUserRoleByEmail('missing@example.com');

      expect(role).toBeNull();
    });

    it('does not call getFirestore when ADMIN_SHEET_FILE_ID is set (uses email directly for Drive check)', async () => {
      (config as Record<string, unknown>)['adminSheetFileId'] = 'sheet-file-id-123';

      const mockGetUsersWithFileAccess = jest.fn().mockResolvedValue([]);
      (DrivePermissionsService as jest.Mock).mockImplementation(() => ({
        getUsersWithFileAccess: mockGetUsersWithFileAccess,
      }));

      const role = await getUserRoleByEmail('unknown@example.com');

      expect(role).toBeNull();
      // DrivePermissionsService should be instantiated and called
      expect(DrivePermissionsService).toHaveBeenCalled();
      expect(mockGetUsersWithFileAccess).toHaveBeenCalledWith('sheet-file-id-123');
      // getFirestore should NOT be called in the Drive path
      expect(getFirestore).not.toHaveBeenCalled();
    });
  });

  // ── getUserRolesBatch ─────────────────────────────────────────────────────

  describe('getUserRolesBatch', () => {
    it('returns roles for existing users', async () => {
      const doc1 = makeDocSnapshot('uid1', { ...USER_DATA, role: 'admin' });
      const doc2 = makeDocSnapshot('uid2', { ...USER_DATA, role: 'editor' });

      const mockGetAll = jest.fn().mockResolvedValue([doc1, doc2]);
      const mockFs = { collection: jest.fn(), getAll: mockGetAll };
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      // collection().doc() stubs for the ref building
      mockFs.collection.mockReturnValue({
        doc: jest.fn().mockImplementation((uid: string) => ({ id: uid })),
      });

      const result = await getUserRolesBatch(['uid1', 'uid2']);

      expect(result['uid1']).toBe('admin');
      expect(result['uid2']).toBe('editor');
    });

    it('defaults to "user" for UIDs not found in Firestore', async () => {
      const doc1 = makeDocSnapshot('uid1', { ...USER_DATA, role: 'admin' });
      const missingDoc = makeDocSnapshot('uid2', null); // does not exist

      const mockGetAll = jest.fn().mockResolvedValue([doc1, missingDoc]);
      const mockFs = { collection: jest.fn(), getAll: mockGetAll };
      (getFirestore as jest.Mock).mockReturnValue(mockFs);

      mockFs.collection.mockReturnValue({
        doc: jest.fn().mockImplementation((uid: string) => ({ id: uid })),
      });

      const result = await getUserRolesBatch(['uid1', 'uid2']);

      expect(result['uid1']).toBe('admin');
      expect(result['uid2']).toBe('user');
    });

    it('returns an empty object for an empty input array', async () => {
      const result = await getUserRolesBatch([]);
      expect(result).toEqual({});
    });
  });
});
