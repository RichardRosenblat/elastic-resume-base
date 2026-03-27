/**
 * Unit tests for FirestoreUserRepository.
 *
 * Firebase Admin is fully mocked so no real Firebase project or emulator is needed.
 */

jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
}));

import * as admin from 'firebase-admin';
import { FirestoreUserRepository } from '../../src/repositories/firestore-user-repository.js';
import { NotFoundError, ConflictError } from '../../src/errors.js';

/** Minimal Firebase UserRecord used across tests. */
function makeFirebaseRecord(
  overrides: Partial<admin.auth.UserRecord> = {},
): admin.auth.UserRecord {
  return {
    uid: 'uid-001',
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
  } as unknown as admin.auth.UserRecord;
}

/** Helper that builds a FirestoreUserRepository with the given mock auth methods. */
function buildRepo(authMethods: Partial<admin.auth.Auth>): FirestoreUserRepository {
  (admin.auth as jest.Mock).mockReturnValue(authMethods);
  const fakeApp = {} as admin.app.App;
  return new FirestoreUserRepository(fakeApp);
}

describe('FirestoreUserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // createUser
  // ---------------------------------------------------------------------------
  describe('createUser', () => {
    it('returns a mapped UserRecord on success', async () => {
      const repo = buildRepo({
        createUser: jest.fn().mockResolvedValue(makeFirebaseRecord()),
      });

      const result = await repo.createUser({ email: 'user@example.com', password: 'secret' });

      expect(result.uid).toBe('uid-001');
      expect(result.email).toBe('user@example.com');
      expect(result.disabled).toBe(false);
      expect(result.emailVerified).toBe(false);
    });

    it('maps createdAt and lastLoginAt from Firebase metadata', async () => {
      const repo = buildRepo({
        createUser: jest.fn().mockResolvedValue(makeFirebaseRecord()),
      });

      const result = await repo.createUser({ email: 'user@example.com', password: 'secret' });

      expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.lastLoginAt).toBe('2024-01-02T00:00:00.000Z');
    });

    it('throws ConflictError when email already exists', async () => {
      const repo = buildRepo({
        createUser: jest.fn().mockRejectedValue(new Error('The email address is already in use (email already exists)')),
      });

      await expect(
        repo.createUser({ email: 'dup@example.com', password: 'secret' }),
      ).rejects.toThrow(ConflictError);
    });

    it('re-throws unknown errors unmodified', async () => {
      const unknownError = new Error('network failure');
      const repo = buildRepo({
        createUser: jest.fn().mockRejectedValue(unknownError),
      });

      await expect(
        repo.createUser({ email: 'user@example.com', password: 'secret' }),
      ).rejects.toThrow('network failure');
    });
  });

  // ---------------------------------------------------------------------------
  // getUserByUID
  // ---------------------------------------------------------------------------
  describe('getUserByUID', () => {
    it('returns a mapped UserRecord when the user exists', async () => {
      const repo = buildRepo({
        getUser: jest.fn().mockResolvedValue(makeFirebaseRecord({ uid: 'uid-001' })),
      });

      const result = await repo.getUserByUID('uid-001');
      expect(result.uid).toBe('uid-001');
    });

    it('throws NotFoundError when Firebase returns a not-found message', async () => {
      const repo = buildRepo({
        getUser: jest
          .fn()
          .mockRejectedValue(new Error('There is no user record corresponding to uid')),
      });

      await expect(repo.getUserByUID('missing')).rejects.toThrow(NotFoundError);
    });

    it('re-throws non-not-found errors unmodified', async () => {
      const repo = buildRepo({
        getUser: jest.fn().mockRejectedValue(new Error('permission denied')),
      });

      await expect(repo.getUserByUID('uid-001')).rejects.toThrow('permission denied');
    });
  });

  // ---------------------------------------------------------------------------
  // updateUserByUID
  // ---------------------------------------------------------------------------
  describe('updateUserByUID', () => {
    it('returns the updated UserRecord on success', async () => {
      const repo = buildRepo({
        updateUser: jest.fn().mockResolvedValue(makeFirebaseRecord({ displayName: 'Updated' })),
      });

      const result = await repo.updateUserByUID('uid-001', { displayName: 'Updated' });
      expect(result.displayName).toBe('Updated');
    });

    it('throws NotFoundError when Firebase returns a not-found message', async () => {
      const repo = buildRepo({
        updateUser: jest
          .fn()
          .mockRejectedValue(new Error('no user record corresponding to the provided identifier')),
      });

      await expect(repo.updateUserByUID('missing', {})).rejects.toThrow(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteUserByUID
  // ---------------------------------------------------------------------------
  describe('deleteUserByUID', () => {
    it('resolves without error when deletion succeeds', async () => {
      const deleteMock = jest.fn().mockResolvedValue(undefined);
      const repo = buildRepo({ deleteUser: deleteMock });

      await expect(repo.deleteUserByUID('uid-001')).resolves.toBeUndefined();
      expect(deleteMock).toHaveBeenCalledWith('uid-001');
    });

    it('throws NotFoundError when Firebase returns a not-found message', async () => {
      const repo = buildRepo({
        deleteUser: jest
          .fn()
          .mockRejectedValue(new Error('There is no user record corresponding to uid')),
      });

      await expect(repo.deleteUserByUID('missing')).rejects.toThrow(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // listUsers
  // ---------------------------------------------------------------------------
  describe('listUsers', () => {
    it('returns mapped users and the next-page token', async () => {
      const repo = buildRepo({
        listUsers: jest.fn().mockResolvedValue({
          users: [makeFirebaseRecord(), makeFirebaseRecord({ uid: 'uid-002' })],
          pageToken: 'next-page-token',
        }),
      });

      const result = await repo.listUsers(10);
      expect(result.users).toHaveLength(2);
      expect(result.pageToken).toBe('next-page-token');
    });

    it('returns an empty list when no users exist', async () => {
      const repo = buildRepo({
        listUsers: jest.fn().mockResolvedValue({ users: [], pageToken: undefined }),
      });

      const result = await repo.listUsers();
      expect(result.users).toHaveLength(0);
      expect(result.pageToken).toBeUndefined();
    });
  });
});
