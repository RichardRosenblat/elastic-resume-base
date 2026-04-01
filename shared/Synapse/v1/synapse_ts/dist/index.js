// src/persistence.ts
import admin from "firebase-admin";
function initializePersistence(options) {
  if (admin.apps.length > 0) {
    return;
  }
  const appOptions = {
    projectId: options.projectId
  };
  if (options.serviceAccountKey) {
    try {
      const raw = options.serviceAccountKey.trim();
      const decoded = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
      const credentials = JSON.parse(decoded);
      appOptions.credential = admin.credential.cert(credentials);
    } catch {
    }
  }
  admin.initializeApp(appOptions);
}
async function terminatePersistence() {
  if (admin.apps.length === 0) {
    return;
  }
  const app = admin.app();
  await app.delete();
}

// src/repositories/firestore-user-repository.ts
import * as admin2 from "firebase-admin";

// ../../../Toolbox/v1/toolbox_ts/src/errors.ts
var AppError = class extends Error {
  statusCode;
  code;
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
};
var NotFoundError = class extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
};
var ConflictError = class extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
};

// src/repositories/firestore-user-repository.ts
var FIREBASE_USER_NOT_FOUND_MESSAGES = [
  "there is no user record",
  "no user record",
  "user not found"
];
var FIREBASE_DUPLICATE_MESSAGES = ["email already exists", "uid already exists"];
function isNotFoundMessage(message) {
  return FIREBASE_USER_NOT_FOUND_MESSAGES.some((m) => message.includes(m));
}
function isDuplicateMessage(message) {
  return FIREBASE_DUPLICATE_MESSAGES.some((m) => message.includes(m));
}
function mapRecord(record) {
  return {
    uid: record.uid,
    email: record.email,
    displayName: record.displayName,
    photoURL: record.photoURL,
    disabled: record.disabled,
    emailVerified: record.emailVerified,
    createdAt: record.metadata.creationTime,
    lastLoginAt: record.metadata.lastSignInTime
  };
}
var FirestoreUserRepository = class {
  _auth;
  /**
   * @param app - An initialised Firebase Admin {@link FirebaseApp.App} instance.
   */
  constructor(app) {
    this._auth = admin2.auth(app);
  }
  /**
   * Creates a new Firebase Auth user.
   *
   * @param data - User attributes for creation.
   * @returns The newly created {@link UserRecord}.
   * @throws {ConflictError} If the email address is already registered.
   */
  async createUser(data) {
    try {
      const record = await this._auth.createUser(data);
      return mapRecord(record);
    } catch (err) {
      if (err instanceof Error) {
        const lower = err.message.toLowerCase();
        if (isDuplicateMessage(lower)) {
          throw new ConflictError(`A user with email '${data.email}' already exists`);
        }
      }
      throw err;
    }
  }
  /**
   * Retrieves a Firebase Auth user by UID.
   *
   * @param uid - Unique identifier of the user.
   * @returns The corresponding {@link UserRecord}.
   * @throws {NotFoundError} If no user with that UID exists.
   */
  async getUserByUID(uid) {
    try {
      const record = await this._auth.getUser(uid);
      return mapRecord(record);
    } catch (err) {
      if (err instanceof Error && isNotFoundMessage(err.message.toLowerCase())) {
        throw new NotFoundError(`User with UID '${uid}' not found`);
      }
      throw err;
    }
  }
  /**
   * Updates mutable attributes of a Firebase Auth user.
   *
   * @param uid - Unique identifier of the user to update.
   * @param data - Fields to update.
   * @returns The updated {@link UserRecord}.
   * @throws {NotFoundError} If no user with that UID exists.
   */
  async updateUserByUID(uid, data) {
    try {
      const record = await this._auth.updateUser(uid, data);
      return mapRecord(record);
    } catch (err) {
      if (err instanceof Error && isNotFoundMessage(err.message.toLowerCase())) {
        throw new NotFoundError(`User with UID '${uid}' not found`);
      }
      throw err;
    }
  }
  /**
   * Permanently deletes a Firebase Auth user.
   *
   * @param uid - Unique identifier of the user to delete.
   * @throws {NotFoundError} If no user with that UID exists.
   */
  async deleteUserByUID(uid) {
    try {
      await this._auth.deleteUser(uid);
    } catch (err) {
      if (err instanceof Error && isNotFoundMessage(err.message.toLowerCase())) {
        throw new NotFoundError(`User with UID '${uid}' not found`);
      }
      throw err;
    }
  }
  /**
   * Lists Firebase Auth users with optional pagination.
   *
   * @param maxResults - Maximum number of records to return per page (default: 100).
   * @param pageToken - Opaque pagination token from a previous call.
   * @returns A {@link ListUsersResult} with the page of users and an optional next-page token.
   */
  async listUsers(maxResults, pageToken) {
    const result = await this._auth.listUsers(maxResults, pageToken);
    return {
      users: result.users.map(mapRecord),
      pageToken: result.pageToken
    };
  }
};

// src/repositories/firestore-user-document-store.ts
import { getFirestore, FieldPath } from "firebase-admin/firestore";
function mapDoc(id, data) {
  return {
    uid: id,
    email: data["email"],
    role: data["role"],
    enable: data["enable"]
  };
}
var FirestoreUserDocumentStore = class {
  _collectionName;
  constructor(collectionName) {
    this._collectionName = collectionName;
  }
  get _collection() {
    return getFirestore().collection(this._collectionName);
  }
  /**
   * Creates a new user document in the Firestore collection.
   *
   * @param data - User attributes for the new document.
   * @returns The newly created {@link UserDocument}.
   * @throws {ConflictError} If a user document with the same UID already exists.
   */
  async createUser(data) {
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
  async getUserByUid(uid) {
    const snap = await this._collection.doc(uid).get();
    if (!snap.exists) {
      throw new NotFoundError(`User with UID '${uid}' not found`);
    }
    return mapDoc(snap.id, snap.data());
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
  async getUserByEmail(email) {
    const snap = await this._collection.where("email", "==", email).limit(1).get();
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
  async updateUser(uid, data) {
    const docRef = this._collection.doc(uid);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`User with UID '${uid}' not found`);
    }
    await docRef.update(data);
    const updated = await docRef.get();
    return mapDoc(updated.id, updated.data());
  }
  /**
   * Permanently removes a user document.
   *
   * @param uid - Unique identifier of the user to delete.
   * @throws {NotFoundError} If no user document exists for the given UID.
   */
  async deleteUser(uid) {
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
  async listUsers(maxResults = 100, pageToken, filters) {
    let query = this._collection;
    if (filters?.email !== void 0) {
      query = query.where("email", "==", filters.email);
    }
    if (filters?.role !== void 0) {
      query = query.where("role", "==", filters.role);
    }
    if (filters?.enable !== void 0) {
      query = query.where("enable", "==", filters.enable);
    }
    query = query.orderBy(FieldPath.documentId()).limit(maxResults);
    if (pageToken) {
      query = query.startAfter(pageToken);
    }
    const snap = await query.get();
    const users = snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
    const lastDoc = snap.docs.at(-1);
    const nextPageToken = snap.docs.length === maxResults && lastDoc ? lastDoc.id : void 0;
    return { users, pageToken: nextPageToken };
  }
};

// src/repositories/firestore-pre-approved-store.ts
import { getFirestore as getFirestore2 } from "firebase-admin/firestore";
function mapDoc2(id, data) {
  return {
    email: id,
    role: data["role"]
  };
}
var FirestorePreApprovedStore = class {
  _collectionName;
  constructor(collectionName) {
    this._collectionName = collectionName;
  }
  get _collection() {
    return getFirestore2().collection(this._collectionName);
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
  async add(data) {
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
  async getByEmail(email) {
    const snap = await this._collection.doc(email.toLowerCase()).get();
    if (!snap.exists) {
      return null;
    }
    return mapDoc2(snap.id, snap.data());
  }
  /**
   * Updates the role of an existing pre-approved entry.
   *
   * @param email - The email address of the entry to update (case-insensitive).
   * @param data - Fields to update.
   * @returns The updated {@link PreApprovedDocument}.
   * @throws {NotFoundError} If no pre-approved entry exists for the given email.
   */
  async update(email, data) {
    const id = email.toLowerCase();
    const docRef = this._collection.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`Pre-approved entry for '${id}' not found`);
    }
    await docRef.update(data);
    const updated = await docRef.get();
    return mapDoc2(updated.id, updated.data());
  }
  /**
   * Permanently removes a pre-approved entry.
   *
   * @param email - The email address of the entry to delete (case-insensitive).
   * @throws {NotFoundError} If no pre-approved entry exists for the given email.
   */
  async delete(email) {
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
  async list(filters) {
    let query = this._collection;
    if (filters?.role !== void 0) {
      query = query.where("role", "==", filters.role);
    }
    const snap = await query.get();
    return snap.docs.map((doc) => mapDoc2(doc.id, doc.data()));
  }
};
export {
  FirestorePreApprovedStore,
  FirestoreUserDocumentStore,
  FirestoreUserRepository,
  initializePersistence,
  terminatePersistence
};
//# sourceMappingURL=index.js.map
