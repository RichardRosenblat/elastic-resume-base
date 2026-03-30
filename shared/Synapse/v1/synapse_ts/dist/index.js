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
  async getUserByUid(uid) {
    const snap = await this._collection.doc(uid).get();
    if (!snap.exists) {
      throw new NotFoundError(`User with UID '${uid}' not found`);
    }
    return mapDoc(snap.id, snap.data());
  }
  async getUserByEmail(email) {
    const snap = await this._collection.where("email", "==", email).limit(1).get();
    const doc = snap.docs[0];
    if (!doc) {
      return null;
    }
    return mapDoc(doc.id, doc.data());
  }
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
  async deleteUser(uid) {
    const docRef = this._collection.doc(uid);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`User with UID '${uid}' not found`);
    }
    await docRef.delete();
  }
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
  async getByEmail(email) {
    const snap = await this._collection.doc(email.toLowerCase()).get();
    if (!snap.exists) {
      return null;
    }
    return mapDoc2(snap.id, snap.data());
  }
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
  async delete(email) {
    const id = email.toLowerCase();
    const docRef = this._collection.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      throw new NotFoundError(`Pre-approved entry for '${id}' not found`);
    }
    await docRef.delete();
  }
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
