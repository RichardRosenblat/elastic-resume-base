import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import type { CollectionReference, Query, DocumentData, UpdateData } from 'firebase-admin/firestore';
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
function mapDoc(id: string, data: DocumentData): UserDocument {
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

  private get _collection(): CollectionReference {
    return getFirestore().collection(this._collectionName);
  }

  /**
   * Creates a new user document in the Firestore collection.
   *
   * @param data - User attributes for the new document.
   * @returns The newly created {@link UserDocument}.
   * @throws {ConflictError} If a user document with the same UID already exists.
   */
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

  /**
   * Retrieves a user document by UID.
   *
   * @param uid - Unique identifier of the user.
   * @returns The matching {@link UserDocument}.
   * @throws {NotFoundError} If no user document exists for the given UID.
   */
  async getUserByUid(uid: string): Promise<UserDocument> {
    const snap = await this._collection.doc(uid).get();
    if (!snap.exists) {
      throw new NotFoundError(`User with UID '${uid}' not found`);
    }
    return mapDoc(snap.id, snap.data()!);
  }

  /**
   * Retrieves a user document by email address.
   *
   * Performs a Firestore equality query on the `email` field — only the first
   * matching document is returned.
   *
   * @param email - The email address to look up.
   * @returns The matching {@link UserDocument}, or `null` if not found.
   */
  async getUserByEmail(email: string): Promise<UserDocument | null> {
    const snap = await this._collection.where('email', '==', email).limit(1).get();
    const doc = snap.docs[0];
    if (!doc) {
      return null;
    }
    return mapDoc(doc.id, doc.data());
  }

  /**
   * Updates mutable fields of an existing user document.
   *
   * @param uid - Unique identifier of the user to update.
   * @param data - Fields to update.
   * @returns The updated {@link UserDocument}.
   * @throws {NotFoundError} If no user document exists for the given UID.
   */
  async updateUser(uid: string, data: UpdateUserDocumentData): Promise<UserDocument> {
    const docRef = this._collection.doc(uid);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`User with UID '${uid}' not found`);
    }
    await docRef.update(data as UpdateData<DocumentData>);
    const updated = await docRef.get();
    return mapDoc(updated.id, updated.data()!);
  }

  /**
   * Permanently removes a user document.
   *
   * @param uid - Unique identifier of the user to delete.
   * @throws {NotFoundError} If no user document exists for the given UID.
   */
  async deleteUser(uid: string): Promise<void> {
    const docRef = this._collection.doc(uid);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`User with UID '${uid}' not found`);
    }
    await docRef.delete();
  }

  /**
   * Lists user documents with optional pagination and field filters.
   *
   * Results are ordered by document ID and limited to `maxResults` per page.
   * Pass the `pageToken` from a previous response to retrieve the next page.
   *
   * @param maxResults - Maximum number of documents to return (default: 100).
   * @param pageToken - Opaque pagination cursor from a previous call.
   * @param filters - Optional filters to narrow the result set (email, role, enable).
   * @returns A {@link ListUserDocumentsResult} with the current page of documents
   *   and an optional next-page token.
   */
  async listUsers(
    maxResults = 100,
    pageToken?: string,
    filters?: UserDocumentFilters,
  ): Promise<ListUserDocumentsResult> {
    let query: Query = this._collection;

    if (filters?.email !== undefined) {
      query = query.where('email', '==', filters.email);
    }
    if (filters?.role !== undefined) {
      query = query.where('role', '==', filters.role);
    }
    if (filters?.enable !== undefined) {
      query = query.where('enable', '==', filters.enable);
    }

    query = query.orderBy(FieldPath.documentId()).limit(maxResults);

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
