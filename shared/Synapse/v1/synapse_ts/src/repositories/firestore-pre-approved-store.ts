import { getFirestore } from 'firebase-admin/firestore';
import type { CollectionReference, Query, DocumentData, UpdateData } from 'firebase-admin/firestore';
import { NotFoundError, ConflictError } from '../errors.js';
import type {
  IPreApprovedStore,
  PreApprovedDocument,
  CreatePreApprovedData,
  UpdatePreApprovedData,
  PreApprovedFilters,
} from '../interfaces/pre-approved-store.js';

/**
 * Maps a Firestore document snapshot to a {@link PreApprovedDocument}.
 */
function mapDoc(id: string, data: DocumentData): PreApprovedDocument {
  return {
    email: id,
    role: data['role'] as string,
  };
}

/**
 * Concrete {@link IPreApprovedStore} implementation backed by Firestore.
 * Uses the lowercased email address as the document ID.
 */
export class FirestorePreApprovedStore implements IPreApprovedStore {
  private readonly _collectionName: string;

  constructor(collectionName: string) {
    this._collectionName = collectionName;
  }

  private get _collection(): CollectionReference {
    return getFirestore().collection(this._collectionName);
  }

  /**
   * Adds a new pre-approved entry to the store.
   *
   * The email address is normalised to lowercase before being stored as the
   * document ID, guaranteeing case-insensitive uniqueness.
   *
   * @param data - Pre-approval data containing the email and role to assign.
   * @returns The newly created {@link PreApprovedDocument}.
   * @throws {ConflictError} If a pre-approved entry for this email already exists.
   */
  async add(data: CreatePreApprovedData): Promise<PreApprovedDocument> {
    const id = data.email.toLowerCase();
    const docRef = this._collection.doc(id);
    const existing = await docRef.get();
    if (existing.exists) {
      throw new ConflictError(`Pre-approved entry for '${id}' already exists`);
    }
    await docRef.set({ role: data.role });
    return { email: id, role: data.role };
  }

  /**
   * Retrieves a pre-approved entry by email address.
   *
   * @param email - The email address to look up (case-insensitive).
   * @returns The matching {@link PreApprovedDocument}, or `null` if not found.
   */
  async getByEmail(email: string): Promise<PreApprovedDocument | null> {
    const snap = await this._collection.doc(email.toLowerCase()).get();
    if (!snap.exists) {
      return null;
    }
    return mapDoc(snap.id, snap.data()!);
  }

  /**
   * Updates the role of an existing pre-approved entry.
   *
   * @param email - The email address of the entry to update (case-insensitive).
   * @param data - Fields to update.
   * @returns The updated {@link PreApprovedDocument}.
   * @throws {NotFoundError} If no pre-approved entry exists for the given email.
   */
  async update(email: string, data: UpdatePreApprovedData): Promise<PreApprovedDocument> {
    const id = email.toLowerCase();
    const docRef = this._collection.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`Pre-approved entry for '${id}' not found`);
    }
    await docRef.update(data as UpdateData<DocumentData>);
    const updated = await docRef.get();
    return mapDoc(updated.id, updated.data()!);
  }

  /**
   * Permanently removes a pre-approved entry.
   *
   * @param email - The email address of the entry to delete (case-insensitive).
   * @throws {NotFoundError} If no pre-approved entry exists for the given email.
   */
  async delete(email: string): Promise<void> {
    const id = email.toLowerCase();
    const docRef = this._collection.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`Pre-approved entry for '${id}' not found`);
    }
    await docRef.delete();
  }

  /**
   * Lists all pre-approved entries, with optional filtering by role.
   *
   * @param filters - Optional filters to narrow the result set.
   * @returns An array of {@link PreApprovedDocument} objects matching the filters.
   */
  async list(filters?: PreApprovedFilters): Promise<PreApprovedDocument[]> {
    let query: Query = this._collection;

    if (filters?.role !== undefined) {
      query = query.where('role', '==', filters.role);
    }

    const snap = await query.get();
    return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
  }
}
