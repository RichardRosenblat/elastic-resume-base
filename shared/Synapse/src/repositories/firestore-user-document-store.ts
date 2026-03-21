import { getFirestore } from 'firebase-admin/firestore';
import { NotFoundError, ConflictError } from '../errors.js';
import type {
  IUserDocumentStore,
  UserDocument,
  CreateUserDocumentData,
  UpdateUserDocumentData,
  UserDocumentFilters,
  ListUserDocumentsResult,
} from '../interfaces/user-document-store.js';

/**
 * Maps a Firestore document snapshot to a {@link UserDocument}.
 */
function mapDoc(id: string, data: FirebaseFirestore.DocumentData): UserDocument {
  return {
    uid: id,
    email: data['email'] as string,
    role: data['role'] as string,
    enable: data['enable'] as boolean,
  };
}

/**
 * Concrete {@link IUserDocumentStore} implementation backed by Firestore.
 */
export class FirestoreUserDocumentStore implements IUserDocumentStore {
  private readonly _collectionName: string;

  constructor(collectionName: string) {
    this._collectionName = collectionName;
  }

  private get _collection(): FirebaseFirestore.CollectionReference {
    return getFirestore().collection(this._collectionName);
  }

  async createUser(data: CreateUserDocumentData): Promise<UserDocument> {
    const docRef = this._collection.doc(data.uid);
    const existing = await docRef.get();
    if (existing.exists) {
      throw new ConflictError(`User '${data.uid}' already exists`);
    }
    const payload = { email: data.email, role: data.role, enable: data.enable };
    await docRef.set(payload);
    return { uid: data.uid, ...payload };
  }

  async getUserByUid(uid: string): Promise<UserDocument> {
    const snap = await this._collection.doc(uid).get();
    if (!snap.exists) {
      throw new NotFoundError(`User '${uid}' not found`);
    }
    return mapDoc(snap.id, snap.data()!);
  }

  async getUserByEmail(email: string): Promise<UserDocument | null> {
    const snap = await this._collection.where('email', '==', email).limit(1).get();
    const doc = snap.docs[0];
    if (!doc) {
      return null;
    }
    return mapDoc(doc.id, doc.data());
  }

  async updateUser(uid: string, data: UpdateUserDocumentData): Promise<UserDocument> {
    const docRef = this._collection.doc(uid);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`User '${uid}' not found`);
    }
    await docRef.update(data as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
    const updated = await docRef.get();
    return mapDoc(updated.id, updated.data()!);
  }

  async deleteUser(uid: string): Promise<void> {
    const docRef = this._collection.doc(uid);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`User '${uid}' not found`);
    }
    await docRef.delete();
  }

  async listUsers(
    maxResults = 100,
    pageToken?: string,
    filters?: UserDocumentFilters,
  ): Promise<ListUserDocumentsResult> {
    let query: FirebaseFirestore.Query = this._collection;

    if (filters?.role !== undefined) {
      query = query.where('role', '==', filters.role);
    }
    if (filters?.enable !== undefined) {
      query = query.where('enable', '==', filters.enable);
    }

    query = query.orderBy(FirebaseFirestore.FieldPath.documentId()).limit(maxResults);

    if (pageToken) {
      query = query.startAfter(pageToken);
    }

    const snap = await query.get();
    const users = snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
    const lastDoc = snap.docs.at(-1);
    const nextPageToken = snap.docs.length === maxResults && lastDoc ? lastDoc.id : undefined;

    return { users, pageToken: nextPageToken };
  }
}
