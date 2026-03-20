/**
 * Unit tests for allowlistService.
 *
 * Coverage:
 * - getAllowlistEntry: found, not found
 * - upsertAllowlistEntry: creates entry, updates entry
 * - deleteAllowlistEntry: found, not found
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
    allowlistCollection: 'allowlist',
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
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { NotFoundError } from '../../../src/errors.js';
import {
  getAllowlistEntry,
  upsertAllowlistEntry,
  deleteAllowlistEntry,
} from '../../../src/services/allowlistService.js';

// ── Helpers ──

function makeDocSnapshot(
  id: string,
  data: Record<string, unknown> | null,
): DocumentSnapshot {
  return {
    id,
    exists: data !== null,
    data: () => data ?? undefined,
  } as unknown as DocumentSnapshot;
}

// ── Test suite ──

describe('allowlistService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getAllowlistEntry ─────────────────────────────────────────────────────

  describe('getAllowlistEntry', () => {
    it('returns the allowlist entry when found', async () => {
      const docData = { email: 'admin@company.com', role: 'admin' };
      const mockDocRef = {
        get: jest.fn().mockResolvedValue(makeDocSnapshot('admin@company.com', docData)),
      };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      const result = await getAllowlistEntry('admin@company.com');

      expect(result.email).toBe('admin@company.com');
      expect(result.role).toBe('admin');
    });

    it('normalises email to lowercase', async () => {
      const docData = { email: 'admin@company.com', role: 'admin' };
      const mockDocRef = {
        get: jest.fn().mockResolvedValue(makeDocSnapshot('admin@company.com', docData)),
      };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      await getAllowlistEntry('ADMIN@COMPANY.COM');

      expect(mockCollection.doc).toHaveBeenCalledWith('admin@company.com');
    });

    it('throws NotFoundError when entry does not exist', async () => {
      const mockDocRef = {
        get: jest.fn().mockResolvedValue(makeDocSnapshot('missing@example.com', null)),
      };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      await expect(getAllowlistEntry('missing@example.com')).rejects.toThrow(NotFoundError);
    });
  });

  // ── upsertAllowlistEntry ──────────────────────────────────────────────────

  describe('upsertAllowlistEntry', () => {
    it('creates or updates an entry and returns it', async () => {
      const docData = { email: 'user@company.com', role: 'user' };
      const setMock = jest.fn().mockResolvedValue(undefined);
      const getMock = jest.fn().mockResolvedValue(makeDocSnapshot('user@company.com', docData));
      const mockDocRef = { set: setMock, get: getMock };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      const result = await upsertAllowlistEntry('user@company.com', 'user');

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@company.com', role: 'user' }),
        { merge: true },
      );
      expect(result.email).toBe('user@company.com');
      expect(result.role).toBe('user');
    });

    it('normalises email to lowercase', async () => {
      const docData = { email: 'admin@company.com' };
      const setMock = jest.fn().mockResolvedValue(undefined);
      const getMock = jest.fn().mockResolvedValue(makeDocSnapshot('admin@company.com', docData));
      const mockDocRef = { set: setMock, get: getMock };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      await upsertAllowlistEntry('ADMIN@COMPANY.COM', 'admin');

      expect(setMock.mock.calls[0][0]).toMatchObject({ email: 'admin@company.com' });
    });

    it('does not include role field when role is not provided', async () => {
      const docData = { email: 'user@example.com' };
      const setMock = jest.fn().mockResolvedValue(undefined);
      const getMock = jest.fn().mockResolvedValue(makeDocSnapshot('user@example.com', docData));
      const mockDocRef = { set: setMock, get: getMock };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      await upsertAllowlistEntry('user@example.com');

      expect(setMock.mock.calls[0][0]).not.toHaveProperty('role');
    });
  });

  // ── deleteAllowlistEntry ──────────────────────────────────────────────────

  describe('deleteAllowlistEntry', () => {
    it('deletes the entry when it exists', async () => {
      const docData = { email: 'user@company.com' };
      const deleteMock = jest.fn().mockResolvedValue(undefined);
      const mockDocRef = {
        get: jest.fn().mockResolvedValue(makeDocSnapshot('user@company.com', docData)),
        delete: deleteMock,
      };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      await deleteAllowlistEntry('user@company.com');

      expect(deleteMock).toHaveBeenCalled();
    });

    it('throws NotFoundError when entry does not exist', async () => {
      const mockDocRef = {
        get: jest.fn().mockResolvedValue(makeDocSnapshot('missing@example.com', null)),
      };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      await expect(deleteAllowlistEntry('missing@example.com')).rejects.toThrow(NotFoundError);
    });

    it('normalises email to lowercase before lookup', async () => {
      const docData = { email: 'user@company.com' };
      const deleteMock = jest.fn().mockResolvedValue(undefined);
      const mockDocRef = {
        get: jest.fn().mockResolvedValue(makeDocSnapshot('user@company.com', docData)),
        delete: deleteMock,
      };
      const mockCollection = { doc: jest.fn().mockReturnValue(mockDocRef) };
      (getFirestore as jest.Mock).mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) });

      await deleteAllowlistEntry('USER@COMPANY.COM');

      expect(mockCollection.doc).toHaveBeenCalledWith('user@company.com');
    });
  });
});
