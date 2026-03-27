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

  async getByEmail(email: string): Promise<PreApprovedDocument | null> {
    const snap = await this._collection.doc(email.toLowerCase()).get();
    if (!snap.exists) {
      return null;
    }
    return mapDoc(snap.id, snap.data()!);
  }

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

  async delete(email: string): Promise<void> {
    const id = email.toLowerCase();
    const docRef = this._collection.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`Pre-approved entry for '${id}' not found`);
    }
    await docRef.delete();
  }

  async list(filters?: PreApprovedFilters): Promise<PreApprovedDocument[]> {
    let query: Query = this._collection;

    if (filters?.role !== undefined) {
      query = query.where('role', '==', filters.role);
    }

    const snap = await query.get();
    return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
  }
}
